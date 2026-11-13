import { getSwarm, aiMode } from "@/lib/swarm";
import { accountBalance, hasRobotKeys, view } from "@/lib/near";
import { json } from "@/lib/ratelimit";
import { COLLECTOR_ID, CONTRACT_ID, DEV_HISTORY, EXPLORER, MARKET_ID, NETWORK, NET_LABEL, OWNER_ID, ROBOT_IDS, ROLES, accountUrl, nearNum, nftUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/** One-glance health check for judges and monitors: is the swarm able to run a full cycle right now? */
export async function GET() {
  try {
    const [approvalsOn, sw, listings, collector, ...robotBal] = await Promise.all([
      view<boolean>("nft_is_approved", { token_id: "0", approved_account_id: MARKET_ID, approval_id: null }).then(() => true).catch(() => false),
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
    const main = NETWORK === "mainnet";
    const tokenIds = (listings as { token_id?: string }[]).map((l) => Number(l.token_id)).filter((n) => Number.isFinite(n));
    const latestToken = tokenIds.length ? Math.max(...tokenIds) : null;
    return json({ ok: true, canRunCycle: canRun, liveOn: NET_LABEL, network: NETWORK, contract: CONTRACT_ID, owner: OWNER_ID, live: sw.live, killSwitch: sw.kill_switch,
      explorer: { base: EXPLORER, contract: accountUrl(CONTRACT_ID), owner: accountUrl(OWNER_ID), robots: Object.fromEntries(ROLES.map((r) => [r, accountUrl(ROBOT_IDS[r])])), latestListedToken: latestToken != null ? nftUrl(latestToken) : null },
      jobsToday, maxJobsPerDay: sw.rules.max_jobs_per_day, listings: listings.length, activeJob: sw.active_job?.id ?? null,
      sales: { sold: Number(sw.stats.sold || 0), note: main
        ? (Number(sw.stats.sold || 0) === 0 ? "No outside sales on mainnet yet. The 30/10/30/15/15 sale split is proven on testnet (development history); the mainnet split is pending its first buyer." : "Sales are split on-chain 30/10/30/15/15; buys by our own accounts are labeled test.")
        : "Testnet: all money is test NEAR; demo-collector buys are labeled test." },
      ...(main ? { developmentHistory: DEV_HISTORY } : { demoCollectorBalance: nearNum(collector) }), robots, ai: aiMode(),
      selling: { venues: ["muse-swarm (direct buy)", `${MARKET_ID} (Mintbase market, NEP-178/199)`], marketplaceApprovals: approvalsOn, marketingPlans: "Seller writes one per piece; X posts are drafts only, never posted" },
      stats: sw.stats });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 502);
  }
}
