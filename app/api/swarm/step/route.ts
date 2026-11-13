import { advance, nextCommission } from "@/lib/swarm";
import { json, rateLimit, chainPace } from "@/lib/ratelimit";
import { hasRobotKeys } from "@/lib/near";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Advance the demo swarm by one robot action (one on-chain tx). Anyone can call it, but:
 * only one job runs at a time (enforced on-chain), the driver of a job is the visitor who
 * opened it, each IP gets a few cycles per 10 minutes, and the contract's daily caps bound spend.
 */
export async function POST(req: Request) {
  if (!hasRobotKeys()) return json({ stage: "error", txs: [], error: "Robot keys are not configured on this server" }, 503);
  const raw = await req.json().catch(() => ({}));
  const body = { driver: typeof raw?.driver === "string" && raw.driver.length <= 64 ? raw.driver : undefined };
  // Opening a job is the expensive part; the other stages just continue it.
  const opening = !body.driver;
  if (opening) {
    const rl = rateLimit(req, "open", 4, 10 * 60_000);
    if (!rl.ok) return json({ stage: "error", txs: [], error: `The robots need a breather: start another cycle in ${rl.retryAfter}s (4 cycles per 10 min per visitor).` }, 429);
    // Swarm-wide pace, read from the contract so it holds across all serverless instances.
    const pace = await chainPace(12, 10 * 60_000).catch(() => ({ ok: true, retryAfter: 0 }));
    // Paid commissions skip the free-demo pacing: the patron already paid for the work.
    if (!pace.ok && !(await nextCommission().catch(() => null))) return json({ stage: "error", txs: [], error: `The swarm has made 12 works in the last 10 minutes and is resting. Next cycle in ${pace.retryAfter}s. Meanwhile, collect a listed work in the Gallery.` }, 429);
  } else {
    const rl = rateLimit(req, "step", 40, 10 * 60_000);
    if (!rl.ok) return json({ stage: "error", txs: [], error: "Too many steps, slow down." }, 429);
  }
  try {
    const r = await advance(body.driver);
    return json(r, r.stage === "error" ? 409 : 200);
  } catch (e) {
    return json({ stage: "error", txs: [], error: String((e as Error).message || e) }, 500);
  }
}
