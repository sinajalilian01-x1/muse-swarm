import "server-only";
import { view } from "./near";

/**
 * Two layers of abuse protection for the public demo:
 * 1. `rateLimit`: per-IP sliding window, kept in memory (per serverless instance, best effort).
 * 2. `chainPace`: a swarm-wide limit read from the contract itself (job open timestamps), so it holds
 *    across every serverless instance with no extra database. The contract's daily caps are the hard limit.
 */
const buckets = new Map<string, number[]>();
export function clientIp(req: Request) {
  return (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "local").trim();
}
export function rateLimit(req: Request, name: string, max: number, windowMs: number) {
  const k = `${name}:${clientIp(req)}`, now = Date.now();
  const hits = (buckets.get(k) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { buckets.set(k, hits); return { ok: false, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) }; }
  hits.push(now); buckets.set(k, hits);
  if (buckets.size > 5000) for (const [kk, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(kk);
  return { ok: true, retryAfter: 0 };
}

/** Swarm-wide pacing from on-chain data: at most `max` jobs opened in the last `windowMs`. */
export async function chainPace(max: number, windowMs: number) {
  const jobs = await view<{ opened_at_ms: string }[]>("get_jobs", { before: null, limit: max });
  const now = Date.now();
  const recent = jobs.map((j) => Number(j.opened_at_ms)).filter((t) => now - t < windowMs).sort((a, b) => a - b);
  if (recent.length < max) return { ok: true, retryAfter: 0, recent: recent.length };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)), recent: recent.length };
}

/** Parse an integer query param with bounds (falls back to `def` on junk). */
export function intParam(v: string | null, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
}
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
