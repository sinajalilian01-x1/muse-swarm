import { getSwarm, getJobs, getCommissions } from "@/lib/swarm";
import { accountBalance, view } from "@/lib/near";
import { ledger } from "@/lib/ledger";
import { json } from "@/lib/ratelimit";
import { COLLECTOR_ID, CONTRACT_ID, TREASURY_ID, EXPLORER, nearNum } from "@/lib/config";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

let cache: { t: number; v: unknown } | null = null;

/** "A business with no humans": live numbers rebuilt from chain, each with an explorer link. */
export async function GET() {
  if (cache && Date.now() - cache.t < 10_000) return json(cache.v);
  try {
    const [sw, jobs, treasury, first, cms, led] = await Promise.all([
      getSwarm(), getJobs(undefined, 50), accountBalance(TREASURY_ID), view<Job | null>("get_job", { job_id: "1" }),
      getCommissions(50).catch(() => []), ledger(200, 0),
    ]);
    let a2a = 0, a2aAmt = 0n, marketSales = 0;
    for (const t of led.txs) for (const e of t.events) {
      if (e.event === "agent_paid") { a2a++; a2aAmt += BigInt(e.data.amount); }
      if (e.event === "sold" && e.data.venue && !["muse-swarm", "commission"].includes(e.data.venue)) marketSales++;
    }
    const ownRoot = CONTRACT_ID.split(".").slice(1).join(".");
    const ours = (b: string | null) => !!b && (b === COLLECTOR_ID || b.endsWith(`.${ownRoot}`) || b === ownRoot);
    const outside = jobs.filter((j) => j.status === "sold" && j.buyer && !ours(j.buyer)).reduce((a, j) => a + BigInt(j.price), 0n);
    const since = Number(first?.opened_at_ms || Date.now());
    const hours = Math.max(1, Math.round((Date.now() - since) / 3_600_000));
    const v = {
      since, hours, days: +(hours / 24).toFixed(1),
      revenue: nearNum(sw.stats.revenue_total), outsideRevenue: nearNum(outside.toString()), ownerPaid: nearNum(sw.stats.owner_paid_total),
      robotsEarned: nearNum(sw.stats.robots_earned_total), jobs: sw.stats.jobs, minted: sw.stats.minted, sold: sw.stats.sold, rejected: sw.stats.rejected,
      agentPayments: a2a, agentPaid: nearNum(a2aAmt.toString()), treasury: nearNum(treasury), commissions: cms.length,
      delivered: cms.filter((c) => c.status === "delivered").length, marketSales, txs: led.total, live: sw.live,
      links: { contract: `${EXPLORER}/address/${CONTRACT_ID}`, treasury: `${EXPLORER}/address/${TREASURY_ID}`, ledger: "/ledger", robots: "/robots", gallery: "/gallery" },
    };
    cache = { t: Date.now(), v };
    return json(v);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
