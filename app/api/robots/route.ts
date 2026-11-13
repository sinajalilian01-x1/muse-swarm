import { accountBalance, accessKeys } from "@/lib/near";
import { getSwarm, getJobs } from "@/lib/swarm";
import { ledger } from "@/lib/ledger";
import { json } from "@/lib/ratelimit";
import { COLLECTOR_ID, CONTRACT_ID, GUARDIAN_ID, OWNER_ID, ROBOT_IDS, ROLES, TREASURY_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Robot accounts, their on-chain access keys and balances, and the swarm's P&L (including gas the robots burned). */
export async function GET() {
  try {
    const [swarm, led, jobs] = await Promise.all([getSwarm(), ledger(100, 0), getJobs(undefined, 50)]);
    const accounts = [...ROLES.map((r) => ROBOT_IDS[r]), GUARDIAN_ID, TREASURY_ID, OWNER_ID, COLLECTOR_ID, CONTRACT_ID];
    const info = await Promise.all(accounts.map(async (id) => ({ id, balance: await accountBalance(id), keys: await accessKeys(id) })));
    const gas: Record<string, string> = {};
    for (const t of led.txs) gas[t.signer] = (BigInt(gas[t.signer] || "0") + BigInt(t.burnt)).toString();
    // Our own test accounts (demo collector, test buyers under the swarm root) never count as outside demand.
    const ownRoot = CONTRACT_ID.split(".").slice(1).join(".");
    const ours = (b: string | null) => !!b && (b === COLLECTOR_ID || b.endsWith(`.${ownRoot}`) || b === ownRoot);
    const demoRevenue = jobs.filter((j) => j.status === "sold" && ours(j.buyer)).reduce((a, j) => a + BigInt(j.price), 0n);
    const extRevenue = jobs.filter((j) => j.status === "sold" && j.buyer && !ours(j.buyer)).reduce((a, j) => a + BigInt(j.price), 0n);
    // Agent-to-agent payments (contract v2 `agent_paid` events) and each agent's track record.
    const gigs: Record<string, { earned: string; paid: string; count: number }> = Object.fromEntries(ROLES.map((r) => [r, { earned: "0", paid: "0", count: 0 }]));
    for (const t of led.txs) for (const e of t.events) if (e.event === "agent_paid") {
      const d = e.data as any; gigs[d.to].earned = (BigInt(gigs[d.to].earned) + BigInt(d.amount)).toString(); gigs[d.to].count++;
      gigs[d.from].paid = (BigInt(gigs[d.from].paid) + BigInt(d.amount)).toString();
    }
    const reviewed = jobs.filter((j) => j.score > 0 || ["rejected", "minted", "listed", "sold"].includes(j.status));
    const approved = reviewed.filter((j) => j.score >= swarm.rules.score_threshold);
    const listedEver = jobs.filter((j) => ["listed", "sold"].includes(j.status));
    const sold = jobs.filter((j) => j.status === "sold");
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const reputation = {
      sample: jobs.length,
      curator: { picks: jobs.length, hitRate: reviewed.length ? approved.length / reviewed.length : 0, sources: [...new Set(jobs.map((j) => { try { return new URL(j.source).hostname.replace(/^www\./, ""); } catch { return "other"; } }))].length },
      painter: { works: jobs.filter((j) => j.media).length, avgScore: avg(reviewed.map((j) => j.score)) / 10, best: Math.max(0, ...reviewed.map((j) => j.score)) / 10 },
      critic: { reviews: reviewed.length, approvalRate: reviewed.length ? approved.length / reviewed.length : 0, rejected: reviewed.length - approved.length },
      seller: { listed: listedEver.length, sellThrough: listedEver.length ? sold.length / listedEver.length : 0, avgPrice: avg(sold.map((j) => Number(BigInt(j.price) / 10n ** 18n) / 1e6)) },
    };
    return json({ gigs, reputation, swarm, accounts: info, gasBurntBySigner: gas, ledgerTxs: led.total, revenue: { demo: demoRevenue.toString(), external: extRevenue.toString(), sampleJobs: jobs.length } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
