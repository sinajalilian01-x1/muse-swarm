import { advance, maybeReprice, maybeMarketBacklog } from "@/lib/swarm";
import { json } from "@/lib/ratelimit";
import { hasRobotKeys } from "@/lib/near";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Autonomous end date (inclusive, CET): Sina approved autonomous running through 17 Nov 2026.
 * Nothing runs from 18 Nov 2026 00:00 CET (= 17 Nov 23:00 UTC) without a new go-ahead.
 * AUTONOMY_END (ISO timestamp) can only move it earlier or later by a redeploy with a new env value.
 */
const AUTONOMY_END_MS = Date.parse(process.env.AUTONOMY_END || "2026-11-18T00:00:00+01:00");

/**
 * Autonomous mode: Vercel Cron calls this 12 times a day (one slot every 2 hours, see vercel.json),
 * with no human in the loop. Each call runs one full job: the swarm picks a trend, paints, critiques,
 * mints and lists on its own, then the Seller may mark down a stale listing. The contract's daily caps
 * and jobs/day limit still apply, and a job only opens if every robot can finish it today.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!(Date.now() < AUTONOMY_END_MS)) return json({ ok: true, skipped: "autonomous window ended", endedAt: new Date(AUTONOMY_END_MS).toISOString() });
  if (!hasRobotKeys()) return json({ error: "robot keys not configured" }, 503);
  const steps: { stage: string; txs: string[]; error?: string }[] = [];
  let driver: string | undefined;
  const t0 = Date.now();
  for (let i = 0; i < 6 && Date.now() - t0 < 100_000; i++) {
    const r = await advance(driver).catch((e) => ({ stage: "error" as const, txs: [], error: String(e?.message || e), driver: undefined, job: null }));
    if (r.driver) driver = r.driver;
    steps.push({ stage: r.stage, txs: r.txs.map((t) => t.hash), error: r.error });
    if (["listed", "rejected", "paused", "busy", "error"].includes(r.stage)) break;
  }
  const rp = Date.now() - t0 < 105_000 ? await maybeReprice().catch(() => null) : null;
  const mk = Date.now() - t0 < 105_000 ? await maybeMarketBacklog().catch(() => null) : null;
  return json({ ok: !steps.some((s) => s.stage === "error"), slot: new URL(req.url).searchParams.get("slot"), steps, repriced: rp?.hash ?? null, marketed: mk?.hash ?? null, autonomyEnds: new Date(AUTONOMY_END_MS).toISOString() });
}
