import { advance } from "@/lib/swarm";
import { json, rateLimit } from "@/lib/ratelimit";
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
  const body = await req.json().catch(() => ({}));
  // Opening a job is the expensive part; the other stages just continue it.
  const opening = !body.driver;
  if (opening) {
    const rl = rateLimit(req, "open", 4, 10 * 60_000);
    if (!rl.ok) return json({ stage: "error", txs: [], error: `The robots need a breather: start another cycle in ${rl.retryAfter}s (4 cycles per 10 min per visitor).` }, 429);
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
