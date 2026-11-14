import { NETWORK } from "@/lib/config";
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
  // A visitor without a driver token who continues an abandoned job (past the driver's grace period)
  // is not opening anything new, so the free-demo pacing does not apply; only the per-IP step limit does.
  // MS-04: pacing is not decided from the presence of a client string. The step limit always applies, and the
  // free-demo open limits run inside advance() exactly when a job would be opened (no active job), whatever was sent.
  const rl = rateLimit(req, "step", 40, 10 * 60_000);
  if (!rl.ok) return json({ stage: "error", txs: [], error: "Too many steps, slow down." }, 429);
  const MAIN = NETWORK === "mainnet";
  const gateOpen = async (): Promise<string | null> => {
    // Mainnet spends real NEAR on gas and AI: much tighter free-demo limits (the contract's daily caps hold regardless).
    const perIp = MAIN ? 2 : 4, perIpWin = MAIN ? 60 * 60_000 : 10 * 60_000, paceMax = MAIN ? Number(process.env.MAINNET_FREE_CYCLES_PER_HOUR || 3) : 12, paceWin = MAIN ? 60 * 60_000 : 10 * 60_000;
    const open = rateLimit(req, "open", perIp, perIpWin);
    if (!open.ok) return `The robots need a breather: start another cycle in ${open.retryAfter}s (${perIp} cycles per ${MAIN ? "hour" : "10 min"} per visitor).`;
    // Swarm-wide pace, read from the contract so it holds across all serverless instances.
    const pace = await chainPace(paceMax, paceWin).catch(() => ({ ok: !MAIN, retryAfter: 60 }));
    // Paid commissions skip the free-demo pacing: the patron already paid for the work.
    if (!pace.ok && !(await nextCommission().catch(() => null))) return `The swarm has made ${paceMax} works in the last ${MAIN ? "hour" : "10 minutes"} and is resting. Next cycle in ${pace.retryAfter}s. Meanwhile, collect a listed work in the Gallery.`;
    return null;
  };
  try {
    const r = await advance(body.driver, { gateOpen });
    return json(r, r.extra?.rateLimited ? 429 : r.stage === "error" ? 409 : 200);
  } catch (e) {
    return json({ stage: "error", txs: [], error: String((e as Error).message || e) }, 500);
  }
}
