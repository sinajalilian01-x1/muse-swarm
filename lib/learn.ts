import "server-only";
import { createHash } from "crypto";
import { PALETTES } from "./art";
import { readSignals, type Counts } from "./signals";
import { ledger } from "./ledger";
import { view } from "./near";
import { nearNum } from "./config";
import type { Job } from "./types";

/** On-chain memo the Curator appends to a brief: the IPFS CID of its decision record (lessons + reasons). */
export const MEMO_RE = /\s*\[L:([A-Za-z0-9]{20,80})\]\s*$/;
export const cleanBrief = (b: string) => String(b || "").replace(MEMO_RE, "").trim();
export const memoCid = (b: string) => String(b || "").match(MEMO_RE)?.[1] || null;

export const paletteOf = (brief: string) => PALETTES.find((p) => cleanBrief(brief).includes(p.name))?.name || null;
export function sourceOf(source: string) {
  const s = (source || "").toLowerCase();
  if (s.includes("ycombinator")) return "Hacker News";
  if (s.includes("commission")) return "Commission";
  return "Google Trends";
}

export interface TokenStats {
  job: string; title: string; status: Job["status"]; palette: string | null; source: string; price: number; firstPrice: number | null;
  views: number; clicks: number; collects: number; sold: boolean; markdowns: number; listedHours: number;
}
export interface Lesson { kind: "palette" | "source" | "price"; text: string; evidence: string }
export interface Learned {
  status: "learning" | "learned";
  summary: string;
  lessons: Lesson[];
  adjust: { preferPalette: string | null; preferSource: string | null; priceFactor: number };
  totals: { views: number; clicks: number; collects: number; sales: number; markdowns: number; listings: number; tokens: number };
  tokens: TokenStats[];
  signalsSince: number | null;
  rules: { minViews: number; minGroupViews: number };
  computedAt: number;
  hash: string;
}

const MIN_VIEWS = 20, MIN_GROUP_VIEWS = 8;
const fmt = (x: number) => (Math.round(x * 100) / 100).toString();

/** Listing history from chain events: first list price and how many markdowns each job got. */
async function listingHistory(): Promise<Map<string, { first: number | null; firstAt: number | null; markdowns: number; soldAt: number | null }>> {
  const m = new Map<string, { first: number | null; firstAt: number | null; markdowns: number; soldAt: number | null }>();
  const empty = { txs: [] as Awaited<ReturnType<typeof ledger>>["txs"] };
  const pages = await Promise.all([ledger(100, 0).catch(() => empty), ledger(100, 100).catch(() => empty)]);
  for (const t of [...pages[0].txs, ...pages[1].txs].sort((a, b) => a.at - b.at)) {
    if (!t.ok) continue;
    for (const e of t.events) {
      const id = e.data?.job_id != null ? String(e.data.job_id) : null;
      if (!id) continue;
      const cur = m.get(id) || { first: null, firstAt: null, markdowns: 0, soldAt: null };
      if (e.event === "listed" && cur.first == null) { cur.first = nearNum(String(e.data.price ?? "0")); cur.firstAt = t.at; }
      if (e.event === "repriced") cur.markdowns++;
      if (e.event === "sold") cur.soldAt = t.at;
      m.set(id, cur);
    }
  }
  return m;
}

function group(tokens: TokenStats[], key: (t: TokenStats) => string | null) {
  const g = new Map<string, { works: number; views: number; eng: number; sold: number }>();
  for (const t of tokens) {
    const k = key(t); if (!k) continue;
    const c = g.get(k) || { works: 0, views: 0, eng: 0, sold: 0 };
    c.works++; c.views += t.views; c.eng += t.clicks + 3 * t.collects + 10 * (t.sold ? 1 : 0); c.sold += t.sold ? 1 : 0;
    g.set(k, c);
  }
  return g;
}

/** Compare one group's engagement per view with everything else; only speaks when both sides have enough views. */
function leader(g: Map<string, { works: number; views: number; eng: number; sold: number }>, label: string) {
  const rows = [...g.entries()].filter(([, v]) => v.views >= MIN_GROUP_VIEWS);
  if (rows.length < 2) return null;
  const rate = (v: { views: number; eng: number }) => v.eng / Math.max(1, v.views);
  rows.sort((a, b) => rate(b[1]) - rate(a[1]));
  const [best, bv] = rows[0];
  const rest = rows.slice(1).reduce((a, [, v]) => ({ views: a.views + v.views, eng: a.eng + v.eng }), { views: 0, eng: 0 });
  const rb = rate(bv), rr = rate(rest);
  if (bv.eng < 3 || rb < 1.5 * Math.max(rr, 0.001)) return null;
  const x = rr > 0 ? `${fmt(rb / rr)}x` : "more";
  return { name: best, text: `${best} ${label} got ${x} the engagement per view (${bv.eng} weighted clicks on ${bv.views} views vs ${rest.eng} on ${rest.views}), so leaning ${best}.`, evidence: `${best}: ${bv.views} views, ${bv.eng} eng; others: ${rest.views} views, ${rest.eng} eng` };
}

let cache: { t: number; v: Learned } | null = null;

/** What the swarm has learned from its own market: real visitor signals plus sales and markdowns read from the chain. */
export async function learn(force = false): Promise<Learned> {
  if (!force && cache && Date.now() - cache.t < 20_000) return cache.v;
  const [sig, jobs, hist, sw] = await Promise.all([
    readSignals().catch(() => ({ counts: {} as Counts, since: null, files: 0 })),
    view<Job[]>("get_jobs", { before: null, limit: 40 }),
    listingHistory(),
    view<{ now_ms: string; rules: { floor: string } }>("get_swarm").catch(() => null),
  ]);
  const now = Number(sw?.now_ms) || Date.now();
  const tokens: TokenStats[] = jobs.filter((j) => j.token_id && (j.status === "listed" || j.status === "sold")).map((j) => {
    const c = sig.counts[j.id] || {}, h = hist.get(j.id);
    const since = h?.firstAt || Number(j.updated_at_ms);
    return { job: j.id, title: j.title, status: j.status, palette: paletteOf(j.brief), source: sourceOf(j.source), price: nearNum(j.price), firstPrice: h?.first ?? null,
      views: c.view || 0, clicks: c.click || 0, collects: c.collect || 0, sold: j.status === "sold", markdowns: h?.markdowns || 0,
      listedHours: Math.max(0, Math.round(((j.status === "sold" ? h?.soldAt || now : now) - since) / 36e5 * 10) / 10) };
  });
  const totals = tokens.reduce((a, t) => ({ views: a.views + t.views, clicks: a.clicks + t.clicks, collects: a.collects + t.collects, sales: a.sales + (t.sold ? 1 : 0), markdowns: a.markdowns + t.markdowns, listings: a.listings + (t.status === "listed" ? 1 : 0), tokens: a.tokens + 1 }),
    { views: 0, clicks: 0, collects: 0, sales: 0, markdowns: 0, listings: 0, tokens: 0 });

  const lessons: Lesson[] = [];
  const adjust = { preferPalette: null as string | null, preferSource: null as string | null, priceFactor: 1 };
  if (totals.views >= MIN_VIEWS) {
    const p = leader(group(tokens, (t) => t.palette), "pieces");
    if (p) { adjust.preferPalette = p.name; lessons.push({ kind: "palette", text: p.text, evidence: p.evidence }); }
    const s = leader(group(tokens, (t) => t.source), "trends");
    if (s) { adjust.preferSource = s.name; lessons.push({ kind: "source", text: s.text.replace("so leaning", "so the Curator leans toward"), evidence: s.evidence }); }
  }
  // Price lessons only use chain facts (sales, list age) and Collect clicks.
  const floor = sw ? nearNum(sw.rules.floor) : 0;
  const recentSale = tokens.some((t) => t.sold && t.listedHours >= 0 && (hist.get(t.job)?.soldAt || 0) > now - 24 * 36e5);
  const stale = tokens.filter((t) => t.status === "listed" && t.listedHours >= 24);
  if (!recentSale && stale.length) {
    adjust.priceFactor = 0.9;
    const atFloor = stale.every((t) => t.price <= floor + 0.0005);
    lessons.push({ kind: "price", text: `Nothing sold in the last 24 h (${stale.length} listing${stale.length > 1 ? "s" : ""} up for a day or more), so the next list price drops 10%${atFloor ? `, but never under the owner's ${floor} NEAR floor` : ""}.`, evidence: `${stale.length} listings ≥24 h, 0 sales in 24 h${totals.collects ? `, ${totals.collects} Collect clicks` : ""}` });
  } else if (recentSale) {
    const sold = tokens.filter((t) => t.sold).sort((a, b) => b.price - a.price)[0];
    adjust.priceFactor = 1.1;
    lessons.push({ kind: "price", text: `“${sold.title}” sold at ${sold.price} NEAR in the last 24 h, so the next list price goes up 10% (inside the owner's max).`, evidence: `sale of #${sold.job}` });
  }
  const status = totals.views >= MIN_VIEWS && lessons.some((l) => l.kind !== "price") ? "learned" : "learning";
  const summary = status === "learned" ? lessons.map((l) => l.text).join(" ")
    : `Learning, not enough data yet: ${totals.views} real gallery view${totals.views === 1 ? "" : "s"} so far (style lessons start at ${MIN_VIEWS}).${lessons.length ? " " + lessons.map((l) => l.text).join(" ") : ""}`;
  const core = { status, summary, lessons, adjust, totals, tokens, signalsSince: sig.since, rules: { minViews: MIN_VIEWS, minGroupViews: MIN_GROUP_VIEWS } };
  const v: Learned = { ...core, status, computedAt: Date.now(), hash: createHash("sha256").update(JSON.stringify(core)).digest("hex") };
  cache = { t: Date.now(), v };
  return v;
}
