import { accountBalance, accessKeys } from "@/lib/near";
import { getSwarm, getJobs } from "@/lib/swarm";
import { ledger } from "@/lib/ledger";
import { json, readLimited } from "@/lib/ratelimit";
import { BOUNTY_ID, COLLECTOR_ID, CONTRACT_ID, GUARDIAN_ID, OWNER_ID, ROBOT_IDS, ROLES, TREASURY_ID, isTestBuyer } from "@/lib/config";

export const dynamic = "force-dynamic";

const acctCache = new Map<string, { t: number; v: { id: string; balance: string; keys: Awaited<ReturnType<typeof accessKeys>> } }>();

/** Robot accounts, their on-chain access keys and balances, and the swarm's P&L (including gas the robots burned). */
export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  try {
    const [swarm, led, jobs] = await Promise.all([getSwarm(), ledger(100, 0), getJobs(undefined, 50)]);
    const accounts = [...ROLES.map((r) => ROBOT_IDS[r]), GUARDIAN_ID, TREASURY_ID, OWNER_ID, COLLECTOR_ID, CONTRACT_ID, BOUNTY_ID];
    // Read accounts in small batches (public RPCs rate-limit bursts) and reuse a warm instance's reads for a few seconds.
    const info: { id: string; balance: string; keys: Awaited<ReturnType<typeof accessKeys>> }[] = [];
    for (let i = 0; i < accounts.length; i += 3) {
      info.push(...(await Promise.all(accounts.slice(i, i + 3).map(async (id) => {
        const c = acctCache.get(id);
        if (c && Date.now() - c.t < 8000) return c.v;
        const v = { id, balance: await accountBalance(id), keys: await accessKeys(id) };
        if (v.keys.length) acctCache.set(id, { t: Date.now(), v });
        return v;
      }))));
    }
    const gas: Record<string, string> = {};
    for (const t of led.txs) gas[t.signer] = (BigInt(gas[t.signer] || "0") + BigInt(t.burnt)).toString();
    // Our own test accounts (demo collector, test buyers under the swarm root) never count as outside demand.
    const ours = (b: string | null) => isTestBuyer(b);
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
    // Short edge cache: the page loads instantly for every visitor, and data is never more than a few seconds old.
    return Response.json({ gigs, reputation, swarm, accounts: info, gasBurntBySigner: gas, ledgerTxs: led.total, revenue: { demo: demoRevenue.toString(), external: extRevenue.toString(), sampleJobs: jobs.length } },
      { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=55" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
