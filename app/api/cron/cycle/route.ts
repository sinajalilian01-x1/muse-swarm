import { advance, maybeReprice, maybeMarketBacklog } from "@/lib/swarm";
import { json } from "@/lib/ratelimit";
import { hasRobotKeys } from "@/lib/near";
import { tick as bountyTick } from "@/lib/bounty";
import { AUTONOMY_END_MS } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Autonomous end date (inclusive, CET): Sina approved autonomous running through 17 Nov 2026.
 * Nothing runs from 18 Nov 2026 00:00 CET (= 17 Nov 23:00 UTC) without a new go-ahead.
 * AUTONOMY_END (ISO timestamp) can only move it earlier or later by a redeploy with a new env value.
 */
// The same end date is enforced inside advance() and the bounty tick (MS-06); this is the cheap short-circuit.

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
  // If a visitor abandoned a job half-way, this slot finishes it first and then, time permitting,
  // still opens its own job, so an abandoned cycle never costs the swarm a cron slot.
  let opened = false;
  for (let i = 0; i < 10 && Date.now() - t0 < 100_000; i++) {
    const r = await advance(driver).catch((e) => ({ stage: "error" as const, txs: [], error: String(e?.message || e), driver: undefined, job: null }));
    if (r.driver) driver = r.driver;
    if (r.stage === "briefed") opened = true;
    steps.push({ stage: r.stage, txs: r.txs.map((t) => t.hash), error: r.error });
    if (["listed", "rejected"].includes(r.stage) && !opened && Date.now() - t0 < 50_000) { driver = undefined; continue; }
    if (["listed", "rejected", "paused", "busy", "error"].includes(r.stage)) break;
  }
  const rp = Date.now() - t0 < 105_000 ? await maybeReprice().catch(() => null) : null;
  const mk = Date.now() - t0 < 105_000 ? await maybeMarketBacklog().catch(() => null) : null;
  // the robots' outside help: judge and pay a due bounty, open the next when the purse can pay it
  const bounty = Date.now() - t0 < 65_000 ? await bountyTick({ open: true }).catch((e) => ({ error: String(e?.message || e) })) : { skipped: "no time left" };
  return json({ ok: !steps.some((s) => s.stage === "error"), bounty, slot: new URL(req.url).searchParams.get("slot"), steps, repriced: rp?.hash ?? null, marketed: mk?.hash ?? null, autonomyEnds: new Date(AUTONOMY_END_MS).toISOString() });
}
