import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { view, robotCall, accountBalance } from "./near";
import { fetchTrends } from "./trends";
import { curatorPick, painterPaint, criticReview, aiMode } from "./ai";
import { pin, fetchIpfs } from "./ipfs";
import { ROBOT_IDS, nearNum, nearToYocto, type Role } from "./config";
import type { Job, Swarm, TxInfo } from "./types";

export const getSwarm = () => view<Swarm>("get_swarm");
export const getJobs = (before?: string, limit = 12) => view<Job[]>("get_jobs", { before: before ?? null, limit });

const secret = () => process.env.JOB_SECRET || "dev-only-secret";
export const driverToken = (jobId: string) => createHmac("sha256", secret()).update(`drive:${jobId}`).digest("base64url");
export function isDriver(jobId: string, token?: string) {
  if (!token) return false;
  const a = Buffer.from(driverToken(jobId)), b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Someone else's job that moved in the last 90 s belongs to its driver; after that anyone may continue it. */
export const DRIVER_GRACE_MS = 90_000;

const REFUEL_BELOW = 0.2, REFUEL_AMOUNT = "0.25";
const balanceCache = new Map<string, { v: number; t: number }>();
async function maybeRefuel(role: Role): Promise<TxInfo | null> {
  const id = ROBOT_IDS[role];
  const c = balanceCache.get(id);
  const bal = c && Date.now() - c.t < 60_000 ? c.v : nearNum(await accountBalance(id));
  balanceCache.set(id, { v: bal, t: Date.now() });
  if (bal >= REFUEL_BELOW) return null;
  const tx = await robotCall(role, "robot_refuel", { amount: nearToYocto(REFUEL_AMOUNT) });
  if (tx.ok) balanceCache.set(id, { v: bal + Number(REFUEL_AMOUNT), t: Date.now() });
  return tx;
}

export function priceFor(score: number, sw: Swarm, recent: Job[]) {
  const floor = nearNum(sw.rules.floor), max = nearNum(sw.rules.max_price), th = sw.rules.score_threshold;
  const q = Math.max(0, Math.min(1, (score - th) / Math.max(1, 100 - th)));
  const market = recent.filter((j) => j.status === "listed" || j.status === "sold").slice(0, 8);
  const sold = market.filter((j) => j.status === "sold").length;
  const demand = market.length ? 0.85 + 0.3 * (sold / market.length) : 1;
  let p = (floor + q * (max - floor) * 0.55) * demand;
  p = Math.max(floor, Math.min(max, Math.round(p * 200) / 200));
  return { price: p, reason: `score ${(score / 10).toFixed(1)}, ${sold}/${market.length || 0} recent works sold` };
}

export interface StepResult {
  stage: "briefed" | "painted" | "minted" | "rejected" | "listed" | "paused" | "busy" | "error";
  job?: Job | null; txs: TxInfo[]; driver?: string; say?: string; error?: string;
  extra?: Record<string, unknown>;
}

const inflight = new Set<string>();

/** Advance the swarm by exactly one robot action. Each action is one on-chain transaction signed by that robot. */
export async function advance(token?: string): Promise<StepResult> {
  const sw = await getSwarm();
  if (!sw.live) return { stage: "paused", txs: [], job: sw.active_job, extra: { kill: sw.kill_switch, until: Number(sw.paused_until_ms) } };
  const job = sw.active_job;
  if (job && !isDriver(job.id, token) && Date.now() - Number(job.updated_at_ms) < DRIVER_GRACE_MS)
    return { stage: "busy", txs: [], job, say: "Another visitor's cycle is running. Watching it live." };
  const lockKey = job ? `${job.id}:${job.status}` : "open";
  if (inflight.has(lockKey)) return { stage: "busy", txs: [], job, say: "Already working on it." };
  inflight.add(lockKey);
  try {
    const txs: TxInfo[] = [];
    if (!job) {
      const [trends, recent] = await Promise.all([fetchTrends(), getJobs(undefined, 12)]);
      const pick = await curatorPick(trends, recent.map((j) => j.trend));
      const r = await maybeRefuel("curator"); if (r) txs.push(r);
      const tx = await robotCall("curator", "curator_open_job", { trend: pick.trend.name, source: pick.trend.url, brief: `${pick.title} — ${pick.brief}`.slice(0, 240), fee: pick.feeYocto, model: pick.model });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error };
      const opened = tx.returnValue as Job;
      return { stage: "briefed", job: opened, txs, driver: driverToken(opened.id), say: pick.line,
        extra: { trend: pick.trend, title: pick.title, palette: pick.palette, scene: pick.scene, others: trends.slice(0, 6).map((t) => t.name), ai: pick.ai, model: pick.model, aiError: pick.error } };
    }
    if (job.status === "briefed") {
      const title = job.brief.includes(" — ") ? job.brief.split(" — ")[0].slice(0, 40) : await titleFromBrief(job);
      const art = await painterPaint(job.id, job.trend, job.brief, title);
      const pinned = await pin(art.bytes, `muse-swarm-job-${job.id}.${art.mime.includes("svg") ? "svg" : "png"}`, art.mime);
      const r = await maybeRefuel("painter"); if (r) txs.push(r);
      const tx = await robotCall("painter", "painter_submit", { job_id: job.id, title: art.title, media: pinned.cid, fee: art.feeYocto, model: art.model });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
      return { stage: "painted", job: tx.returnValue as Job, txs, say: "Done! Isn't it lovely?", extra: { media: pinned.cid, mime: art.mime, ai: art.ai, model: art.model, aiError: art.error } };
    }
    if (job.status === "painted") {
      const img = await fetchIpfs(job.media);
      const mime = img.mime.includes("svg") || img.bytes.subarray(0, 5).toString() === "<svg " ? "image/svg+xml" : img.mime;
      const rv = await criticReview(job.id, job.brief, img.bytes, mime);
      const r = await maybeRefuel("critic"); if (r) txs.push(r);
      const tx = await robotCall("critic", "critic_review", { job_id: job.id, score: rv.score, note: rv.note, fee: rv.feeYocto, model: rv.model });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
      const j = tx.returnValue as Job;
      return { stage: j.status === "minted" ? "minted" : "rejected", job: j, txs, say: rv.line, extra: { score: rv.score, note: rv.note, threshold: sw.rules.score_threshold, ai: rv.ai, model: rv.model, aiError: rv.error } };
    }
    if (job.status === "minted") {
      const recent = await getJobs(undefined, 12);
      const p = priceFor(job.score, sw, recent);
      const r = await maybeRefuel("seller"); if (r) txs.push(r);
      const tx = await robotCall("seller", "seller_list", { job_id: job.id, price: nearToYocto(p.price) });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
      return { stage: "listed", job: tx.returnValue as Job, txs, say: `Listed for ${p.price} NEAR`, extra: { price: p.price, reason: p.reason } };
    }
    return { stage: "error", txs, error: `Unexpected job status ${job.status}`, job };
  } finally {
    inflight.delete(lockKey);
  }
}

async function titleFromBrief(job: Job) {
  const { titleFor, sceneFor, hashSeed, PALETTES } = await import("./art");
  const seed = hashSeed(job.trend);
  const palette = PALETTES.find((p) => job.brief.includes(p.name)) || PALETTES[seed % PALETTES.length];
  return titleFor(job.trend, sceneFor(`${job.trend} ${job.brief}`, seed), palette, seed);
}

export { aiMode };
