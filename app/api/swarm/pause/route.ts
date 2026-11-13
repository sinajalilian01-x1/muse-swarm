import { guardianCall } from "@/lib/near";
import { json, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Public kill-switch demo. The guardian key can only call guardian_pause, and the contract caps a
 * guardian pause at 120 s, so the swarm always comes back by itself. The owner's real kill switch
 * (set_kill_switch) needs the owner's own wallet.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req, "pause", 2, 10 * 60_000);
  if (!rl.ok) return json({ error: `You can pause the swarm again in ${rl.retryAfter}s.` }, 429);
  try {
    const tx = await guardianCall("guardian_pause", { seconds: 45 });
    return json({ tx, until: Number(tx.returnValue ?? 0) }, tx.ok ? 200 : 409);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
}
