import { guardianCall } from "@/lib/near";
import { getSwarm } from "@/lib/swarm";
import { json, rateLimit } from "@/lib/ratelimit";
import { pauseAllowed } from "@/lib/guards";

export const dynamic = "force-dynamic";

/**
 * Public kill-switch demo. The guardian key can only call guardian_pause, and the contract caps a
 * guardian pause at 120 s, so the swarm always comes back by itself. The owner's real kill switch
 * (set_kill_switch) needs the owner's own wallet.
 *
 * MS-05: a pause is refused while the swarm is paused and for 10 minutes after the last pause ended.
 * That cooldown is read from the contract's paused_until, so it holds across every IP and serverless
 * instance: no number of visitors can keep the swarm paused for more than 45 s in any ~11 minutes.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req, "pause", 2, 10 * 60_000);
  if (!rl.ok) return json({ error: `You can pause the swarm again in ${rl.retryAfter}s.` }, 429);
  try {
    const sw = await getSwarm();
    if (sw.kill_switch) return json({ error: "The owner's kill switch is already on." }, 409);
    const ok = pauseAllowed(Number(sw.paused_until_ms || 0));
    if (!ok.ok) return json({ error: ok.reason === "already paused" ? `The swarm is already paused for ${ok.retryAfter}s.` : `The demo pause is cooling down: try again in ${ok.retryAfter}s.` }, 429);
    const tx = await guardianCall("guardian_pause", { seconds: 45 });
    return json({ tx, until: Number(tx.returnValue ?? 0) }, tx.ok ? 200 : 409);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
}
