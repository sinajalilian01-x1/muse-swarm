import { getSwarm, aiMode } from "@/lib/swarm";
import { accountBalance, hasRobotKeys, view } from "@/lib/near";
import { json } from "@/lib/ratelimit";
import { COLLECTOR_ID, CONTRACT_ID, NETWORK, ROBOT_IDS, ROLES, nearNum } from "@/lib/config";

export const dynamic = "force-dynamic";

/** One-glance health check for judges and monitors: is the swarm able to run a full cycle right now? */
export async function GET() {
  try {
    const [sw, listings, collector, ...robotBal] = await Promise.all([
      getSwarm(), view<unknown[]>("get_listings", { from_index: 0, limit: 100 }), accountBalance(COLLECTOR_ID), ...ROLES.map((r) => accountBalance(ROBOT_IDS[r])),
    ]);
    const today = Math.floor(Number(sw.now_ms) / 86_400_000).toString();
    const robots = ROLES.map((r, i) => {
      const rb = sw.robots[i];
      const spent = rb.day === today ? nearNum(rb.spent_today) : 0;
      return { role: r, account: rb.account_id, budget: nearNum(rb.budget), spentToday: spent, dailyCapLeft: +(nearNum(sw.rules.daily_cap) - spent).toFixed(4), gasWallet: nearNum(robotBal[i]) };
    });
    const jobsToday = sw.stats.day === today ? sw.stats.jobs_today : 0;
    const canRun = sw.live && hasRobotKeys() && jobsToday < sw.rules.max_jobs_per_day && robots.every((r) => r.budget > 0.02 && r.dailyCapLeft > 0.02);
    return json({ ok: true, canRunCycle: canRun, network: NETWORK, contract: CONTRACT_ID, live: sw.live, killSwitch: sw.kill_switch,
      jobsToday, maxJobsPerDay: sw.rules.max_jobs_per_day, listings: listings.length, activeJob: sw.active_job?.id ?? null,
      demoCollectorBalance: nearNum(collector), robots, ai: aiMode(), stats: sw.stats });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 502);
  }
}
