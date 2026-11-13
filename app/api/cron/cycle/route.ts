import { advance, maybeReprice, maybeMarketBacklog } from "@/lib/swarm";
import { json } from "@/lib/ratelimit";
import { hasRobotKeys } from "@/lib/near";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Autonomous mode: Vercel Cron calls this daily, with no human in the loop. The swarm picks a trend,
 * paints, critiques, mints and lists one work on its own. The listing then waits for a real collector.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!hasRobotKeys()) return json({ error: "robot keys not configured" }, 503);
  const steps: { stage: string; txs: string[]; error?: string }[] = [];
  let driver: string | undefined;
  const t0 = Date.now();
  for (let i = 0; i < 6 && Date.now() - t0 < 50_000; i++) {
    const r = await advance(driver).catch((e) => ({ stage: "error" as const, txs: [], error: String(e?.message || e), driver: undefined, job: null }));
    if (r.driver) driver = r.driver;
    steps.push({ stage: r.stage, txs: r.txs.map((t) => t.hash), error: r.error });
    if (["listed", "rejected", "paused", "busy", "error"].includes(r.stage)) break;
  }
  const rp = await maybeReprice().catch(() => null);
  const mk = Date.now() - t0 < 45_000 ? await maybeMarketBacklog().catch(() => null) : null;
  return json({ ok: !steps.some((s) => s.stage === "error"), steps, repriced: rp?.hash ?? null, marketed: mk?.hash ?? null });
}
