import "server-only";
/** Best-effort per-IP limiter (per server instance). The contract's caps are the hard limit. */
const buckets = new Map<string, number[]>();
export function rateLimit(req: Request, name: string, max: number, windowMs: number) {
  const ip = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "local").trim();
  const k = `${name}:${ip}`, now = Date.now();
  const hits = (buckets.get(k) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) { buckets.set(k, hits); return { ok: false, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) }; }
  hits.push(now); buckets.set(k, hits);
  if (buckets.size > 5000) for (const [kk, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(kk);
  return { ok: true, retryAfter: 0 };
}
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
