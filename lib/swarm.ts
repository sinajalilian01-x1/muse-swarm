import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { view, robotCall, accountBalance } from "./near";
import { fetchTrends } from "./trends";
import { curatorPick, painterPaint, criticReview, aiMode } from "./ai";
import { pin, fetchIpfs } from "./ipfs";
import { marketingPlan, pinPlan, MARKET_ID, type Plan } from "./marketing";
import { ROBOT_IDS, APP_URL, nearNum, nearToYocto, type Role } from "./config";
import type { Job, Swarm, TxInfo } from "./types";

export const getSwarm = () => view<Swarm>("get_swarm");
export interface Commission { id: string; patron: string; amount: string; brief: string; paid_with: string; status: "open" | "delivered" | "refunded"; job_id: string | null; token_id: string | null; attempts: number; opened_at_ms: string }
export const getCommissions = (limit = 20) => view<Commission[]>("get_commissions", { before: null, limit });
/** Oldest open commission that is ready for a (new) job: never started, or its last attempt was rejected/expired. */
export async function nextCommission(): Promise<Commission | null> {
  const cs = (await getCommissions(20).catch(() => [])).filter((c) => c.status === "open" && c.attempts < 3);
  if (!cs.length) return null;
  const jobs = await getJobs(undefined, 30);
  const ready = cs.filter((c) => !c.job_id || ["rejected", "expired"].includes(jobs.find((j) => j.id === c.job_id)?.status || ""));
  return ready.sort((a, b) => Number(a.id) - Number(b.id))[0] || null;
}
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

/** Contract v2 rule: a listing may be re-priced once it has sat unsold this long. */
const REPRICE_AFTER_MS = 15 * 60_000;
const SELLER_GAS = 150_000_000_000_000n;

/** Seller writes the marketing plan, pins it as the token's NEP-177 reference, and builds the seller_list args. */
async function sellerArgs(job: Job, price: number): Promise<{ args: Record<string, unknown>; plan: Plan | null; planCid?: string }> {
  const plan = await marketingPlan(job, price).catch(() => null);
  let pinned: Awaited<ReturnType<typeof pinPlan>> | null = null;
  if (plan) pinned = await pinPlan(job, plan, price).catch(() => null);
  return { args: { job_id: job.id, price: nearToYocto(price), plan: pinned?.arg ?? null, market: MARKET_ID }, plan, planCid: pinned?.cid };
}

/**
 * Seller's back-catalog loop: a listed piece with no marketing plan / marketplace listing yet (made before v3)
 * gets a plan and a Mintbase cross-listing at its current price. One per call.
 */
export async function maybeMarketBacklog(): Promise<TxInfo | null> {
  const sw = await getSwarm();
  if (!sw.live) return null;
  const jobs = await getJobs(undefined, 40);
  for (const j of jobs.filter((x) => x.status === "listed" && x.token_id)) {
    const t = await view<{ metadata?: { reference?: string | null } } | null>("nft_token", { token_id: j.token_id });
    if (t?.metadata?.reference) continue;
    const { args } = await sellerArgs(j, nearNum(j.price));
    const tx = await robotCall("seller", "seller_list", args, SELLER_GAS).catch(() => null);
    return tx ? { ...tx, method: tx.ok ? "marketed" : tx.method } : null;
  }
  return null;
}
/**
 * The Seller's market loop: an unsold listing older than 15 minutes is marked down 15% (never under the
 * owner's floor, which the contract enforces too). One re-price per call, signed by the Seller's own key
 * through the same seller_list method its function-call key already allows.
 */
export async function maybeReprice(sw?: Swarm): Promise<TxInfo | null> {
  sw = sw || (await getSwarm());
  if (!sw.live) return null;
  const floor = nearNum(sw.rules.floor);
  const jobs = await getJobs(undefined, 30);
  const now = Number(sw.now_ms) || Date.now();
  const stale = jobs.filter((j) => j.status === "listed" && now - Number(j.updated_at_ms) > REPRICE_AFTER_MS && nearNum(j.price) > floor + 0.001)
    .sort((a, b) => Number(a.updated_at_ms) - Number(b.updated_at_ms))[0];
  if (!stale) return null;
  const next = Math.max(floor, Math.floor(nearNum(stale.price) * 0.85 * 200) / 200);
  if (next >= nearNum(stale.price)) return null;
  const tx = await robotCall("seller", "seller_list", { job_id: stale.id, price: nearToYocto(next), plan: null, market: MARKET_ID }, SELLER_GAS).catch(() => null);
  return tx ? { ...tx, method: tx.ok ? "repriced" : tx.method } : null;
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
  // Whoever may advance this job (its driver, or anyone after the grace period) becomes its driver.
  const take = (r: StepResult): StepResult => (job && !r.driver ? { ...r, driver: driverToken(job.id) } : r);
  try {
    const txs: TxInfo[] = [];
    if (!job) {
      const cm = await nextCommission();
      const [trends, recent] = cm
        ? [[{ name: cm.brief.slice(0, 80), source: "Commission", url: `${APP_URL}/?commission=${cm.id}`, context: `commissioned by ${cm.patron}` }], []]
        : await Promise.all([fetchTrends(), getJobs(undefined, 12)]);
      const pick = await curatorPick(trends, recent.map((j) => j.trend));
      if (cm) pick.line = `${cm.patron.length > 20 ? "A patron" : cm.patron} commissioned “${cm.brief.slice(0, 30)}”. On it!`;
      const r = await maybeRefuel("curator"); if (r) txs.push(r);
      const tx = await robotCall("curator", "curator_open_job", { trend: pick.trend.name, source: pick.trend.url, brief: `${pick.title} — ${pick.brief}`.slice(0, 240), fee: pick.feeYocto, model: pick.model, commission_id: cm ? cm.id : null });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error };
      const opened = tx.returnValue as Job;
      return { stage: "briefed", job: opened, txs, driver: driverToken(opened.id), say: pick.line,
        extra: { commission: cm, trend: pick.trend, title: pick.title, palette: pick.palette, scene: pick.scene, others: trends.slice(0, 6).map((t) => t.name), ai: pick.ai, model: pick.model, aiError: pick.error } };
    }
    if (job.status === "briefed") {
      const title = job.brief.includes(" — ") ? job.brief.split(" — ")[0].slice(0, 40) : await titleFromBrief(job);
      const art = await painterPaint(job.id, job.trend, job.brief, title);
      const pinned = await pin(art.bytes, `muse-swarm-job-${job.id}.${art.mime.includes("svg") ? "svg" : "png"}`, art.mime);
      const r = await maybeRefuel("painter"); if (r) txs.push(r);
      const tx = await robotCall("painter", "painter_submit", { job_id: job.id, title: art.title, media: pinned.cid, fee: art.feeYocto, model: art.model });
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
      return take({ stage: "painted", job: tx.returnValue as Job, txs, say: "Done! Isn't it lovely?", extra: { media: pinned.cid, mime: art.mime, ai: art.ai, model: art.model, aiError: art.error } });
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
      return take({ stage: j.status === "minted" ? "minted" : "rejected", job: j, txs, say: rv.line, extra: { score: rv.score, note: rv.note, threshold: sw.rules.score_threshold, ai: rv.ai, model: rv.model, aiError: rv.error } });
    }
    if (job.status === "minted") {
      const cm = (await getCommissions(20).catch(() => [])).find((c) => c.job_id === job.id && c.status === "open");
      if (cm) {
        const sa = await sellerArgs(job, nearNum(cm.amount));
        const r = await maybeRefuel("seller"); if (r) txs.push(r);
        const tx = await robotCall("seller", "seller_list", { ...sa.args, price: sw.rules.floor, market: null }, SELLER_GAS);
        txs.push(tx);
        if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
        return take({ stage: "listed", job: tx.returnValue as Job, txs, say: `Delivered to ${cm.patron.length > 22 ? "the patron" : cm.patron}!`,
          extra: { delivered: cm.patron, commission: cm, price: nearNum(cm.amount), plan: sa.plan, planCid: sa.planCid } });
      }
      const recent = await getJobs(undefined, 12);
      const p = priceFor(job.score, sw, recent);
      const r = await maybeRefuel("seller"); if (r) txs.push(r);
      const sa = await sellerArgs(job, p.price);
      const tx = await robotCall("seller", "seller_list", sa.args, SELLER_GAS);
      txs.push(tx);
      if (!tx.ok) return { stage: "error", txs, error: tx.error, job };
      const crossListed = (tx.events || []).some((e) => e.event === "cross_listed");
      const rp = await maybeReprice(sw).catch(() => null); if (rp) txs.push(rp);
      return take({ stage: "listed", job: tx.returnValue as Job, txs, say: crossListed ? `Listed for ${p.price} NEAR, here and on Mintbase` : `Listed for ${p.price} NEAR`,
        extra: { price: p.price, reason: p.reason, plan: sa.plan, planCid: sa.planCid, market: crossListed ? MARKET_ID : null } });
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
