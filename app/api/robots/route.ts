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
    const demoRevenue = jobs.filter((j) => j.status === "sold" && j.buyer === COLLECTOR_ID).reduce((a, j) => a + BigInt(j.price), 0n);
    const extRevenue = jobs.filter((j) => j.status === "sold" && j.buyer && j.buyer !== COLLECTOR_ID).reduce((a, j) => a + BigInt(j.price), 0n);
    return json({ swarm, accounts: info, gasBurntBySigner: gas, ledgerTxs: led.total, revenue: { demo: demoRevenue.toString(), external: extRevenue.toString(), sampleJobs: jobs.length } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
