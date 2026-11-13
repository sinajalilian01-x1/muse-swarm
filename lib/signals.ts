import "server-only";
import { createHash } from "crypto";
import { fetchIpfs } from "./ipfs";

/**
 * Market signals the Seller watches per token: gallery views, detail clicks, Collect clicks.
 * (Sales, markdowns and time listed come from the chain itself, see lib/learn.ts.)
 *
 * Storage: the app has no database. Everything it keeps lives on NEAR or on IPFS (Pinata), so the
 * signals do too. Each server instance batches the counts it saw in memory and pins them as a small
 * "delta" JSON at most once every FLUSH_MS. Readers add the latest snapshot and every newer delta.
 * When deltas pile up, a reader compacts them into a new snapshot and unpins the old files.
 * Counts are deduplicated per visitor (IP hash) per token per kind per 30 minutes, and bots/headless
 * browsers are ignored, so a refresh loop or our own QA cannot inflate them.
 */
export type SignalKind = "view" | "click" | "collect";
export const KINDS: SignalKind[] = ["view", "click", "collect"];
export type Counts = Record<string, Partial<Record<SignalKind, number>>>; // jobId -> kind -> count

const FLUSH_MS = 45_000;
const DEDUPE_MS = 30 * 60_000;
const COMPACT_AT = Math.max(1, Number(process.env.SIGNALS_COMPACT_AT) || 10);
const APP = "muse-swarm";

let pending: Counts = {};
let pendingN = 0;
let lastFlush = 0;
let flushing: Promise<void> | null = null;
const seen = new Map<string, number>();

const jwt = () => process.env.PINATA_JWT || "";
const salt = () => process.env.JOB_SECRET || "dev";
export const visitorHash = (ip: string) => createHash("sha256").update(`${salt()}:${ip}`).digest("base64url").slice(0, 16);

/** Record one signal in memory. Returns false when it was a duplicate. */
export function record(visitor: string, jobId: string, kind: SignalKind): boolean {
  const now = Date.now();
  const k = `${visitor}:${jobId}:${kind}`;
  const t = seen.get(k);
  if (t && now - t < DEDUPE_MS) return false;
  seen.set(k, now);
  if (seen.size > 20_000) for (const [kk, v] of seen) if (now - v > DEDUPE_MS) seen.delete(kk);
  (pending[jobId] ||= {})[kind] = (pending[jobId][kind] || 0) + 1;
  pendingN++;
  return true;
}

export const flushDue = () => pendingN > 0 && Date.now() - lastFlush > FLUSH_MS;
let scheduled = false;
/** Wait out the rest of the flush window (cheap: no CPU while waiting), then pin the batch. One timer per instance. */
export async function scheduleFlush() {
  if (scheduled || !pendingN) return;
  scheduled = true;
  try {
    const wait = Math.max(0, Math.min(FLUSH_MS, FLUSH_MS - (Date.now() - lastFlush)));
    await new Promise((r) => setTimeout(r, wait));
    await flush(true);
  } finally { scheduled = false; }
}

/** Pin the counts this instance has collected since its last flush. */
export async function flush(force = false): Promise<void> {
  if (!pendingN || !jwt()) return;
  if (!force && Date.now() - lastFlush < FLUSH_MS) return;
  if (flushing) return flushing;
  const batch = pending, n = pendingN;
  pending = {}; pendingN = 0; lastFlush = Date.now();
  flushing = (async () => {
    try {
      const doc = { app: APP, kind: "signals-delta", at: Date.now(), counts: batch };
      await pinNamed(Buffer.from(JSON.stringify(doc)), "muse-swarm-signals-delta.json", "signals-delta");
      cache = null;
    } catch {
      // put the batch back so the next flush retries it
      for (const [j, c] of Object.entries(batch)) for (const [k, v] of Object.entries(c)) (pending[j] ||= {})[k as SignalKind] = (pending[j][k as SignalKind] || 0) + (v || 0);
      pendingN += n;
    } finally { flushing = null; }
  })();
  return flushing;
}

async function pinNamed(bytes: Buffer, name: string, kind: string) {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: "application/json" }), name);
  fd.append("pinataMetadata", JSON.stringify({ name, keyvalues: { app: APP, kind } }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${jwt()}` }, body: fd, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Pinata ${r.status}`);
  return (await r.json()).IpfsHash as string;
}

interface PinRow { ipfs_pin_hash: string; date_pinned: string; metadata?: { name?: string; keyvalues?: Record<string, string> } }
const NAME: Record<string, string> = { "signals-delta": "muse-swarm-signals-delta.json", "signals-snapshot": "muse-swarm-signals.json" };
/** Our own signal pins only: filtered by Pinata metadata AND re-checked here by name + keyvalues (never touch art or plans). */
async function listKind(kind: "signals-delta" | "signals-snapshot", limit = 100): Promise<PinRow[]> {
  const kv = encodeURIComponent(JSON.stringify({ kind: { value: kind, op: "eq" }, app: { value: APP, op: "eq" } }));
  const r = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=${limit}&metadata[name]=${encodeURIComponent(NAME[kind])}&metadata[keyvalues]=${kv}`, { headers: { Authorization: `Bearer ${jwt()}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`Pinata list ${r.status}`);
  const rows: PinRow[] = ((await r.json()).rows || []).filter((x: PinRow) => x.metadata?.name === NAME[kind] && x.metadata?.keyvalues?.kind === kind && x.metadata?.keyvalues?.app === APP);
  return rows.sort((a, b) => Date.parse(b.date_pinned) - Date.parse(a.date_pinned));
}

const docCache = new Map<string, any>();
async function readDoc(cid: string) {
  if (docCache.has(cid)) return docCache.get(cid);
  const { bytes } = await fetchIpfs(cid);
  const d = JSON.parse(bytes.toString("utf8"));
  docCache.set(cid, d);
  return d;
}

function addInto(into: Counts, c: Counts) {
  for (const [j, kv] of Object.entries(c || {})) for (const [k, v] of Object.entries(kv || {})) if (KINDS.includes(k as SignalKind)) (into[j] ||= {})[k as SignalKind] = (into[j][k as SignalKind] || 0) + Number(v || 0);
}

let cache: { t: number; v: { counts: Counts; since: number | null; files: number } } | null = null;
let reading: Promise<{ counts: Counts; since: number | null; files: number }> | null = null;

/** All signals recorded so far (persisted ones plus this instance's unflushed batch). */
export async function readSignals(): Promise<{ counts: Counts; since: number | null; files: number }> {
  if (!jwt()) return { counts: structuredClone(pending), since: null, files: 0 };
  if (!cache || Date.now() - cache.t > 20_000) {
    reading ||= (async () => {
      try {
        const [snaps, deltas] = await Promise.all([listKind("signals-snapshot", 5), listKind("signals-delta", 200)]);
        const snapDoc = snaps[0] ? await readDoc(snaps[0].ipfs_pin_hash).catch(() => null) : null;
        const snap = snapDoc?.app === APP && snapDoc?.kind === "signals-snapshot" ? snapDoc : null;
        const covered = new Set<string>(snap?.covers || []);
        const open = deltas.filter((d) => !covered.has(d.ipfs_pin_hash));
        const docs = ((await Promise.all(open.map((d) => readDoc(d.ipfs_pin_hash).then((x) => ({ cid: d.ipfs_pin_hash, x })).catch(() => null)))).filter(Boolean) as { cid: string; x: any }[])
          .filter((d) => d.x?.app === APP && d.x?.kind === "signals-delta");
        const counts: Counts = {};
        addInto(counts, snap?.counts || {});
        let since: number | null = snap?.since ?? null;
        for (const d of docs) { addInto(counts, d.x.counts); since = since == null ? d.x.at : Math.min(since, d.x.at); }
        const v = { counts, since, files: docs.length + (snap ? 1 : 0) };
        cache = { t: Date.now(), v };
        const listed = new Set(deltas.map((d) => d.ipfs_pin_hash));
        if (docs.length >= COMPACT_AT) compact(counts, since, [...covered, ...docs.map((d) => d.cid)].filter((c) => listed.has(c)), snaps, deltas).catch(() => {});
        return v;
      } finally { reading = null; }
    })();
    try { await reading; } catch { if (!cache) return { counts: structuredClone(pending), since: null, files: 0 }; }
  }
  const out = structuredClone(cache!.v.counts);
  addInto(out, pending);
  return { ...cache!.v, counts: out };
}

/** Fold every delta into one new snapshot, then unpin what it replaced (older snapshots and folded deltas). */
async function compact(counts: Counts, since: number | null, covers: string[], snaps: PinRow[], deltas: PinRow[]) {
  const doc = { app: APP, kind: "signals-snapshot", at: Date.now(), since, counts, covers };
  const cid = await pinNamed(Buffer.from(JSON.stringify(doc)), "muse-swarm-signals.json", "signals-snapshot");
  // only ever unpin rows that listKind verified as our own signal files
  const drop = [...snaps.map((s) => s.ipfs_pin_hash), ...deltas.filter((d) => covers.includes(d.ipfs_pin_hash)).map((d) => d.ipfs_pin_hash)]
    .filter((c) => c !== cid && [...snaps, ...deltas].some((r) => r.ipfs_pin_hash === c && Object.values(NAME).includes(r.metadata?.name || "")));
  // keep the new snapshot's `covers` list so a slow reader never double counts; unpinned deltas just disappear from the list
  for (const c of drop) await fetch(`https://api.pinata.cloud/pinning/unpin/${c}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt()}` }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  cache = null;
}
