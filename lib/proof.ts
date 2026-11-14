import "server-only";
import { view, accountBalance } from "./near";
import { ledger, post } from "./ledger";
import { CONTRACT_ID, OWNER_ID, ROBOT_IDS, TREASURY_ID, GUARDIAN_ID, BOUNTY_ID, NETWORK, EXPLORER, isTestBuyer } from "./config";
import type { Swarm } from "./types";
import snapshot from "./proof-snapshot.json";

/**
 * Mainnet proof: real on-chain evidence for Muse Swarm, rebuilt from public chain data
 * (NEAR RPC via FastNEAR + the FastNEAR tx indexer). Only successful transactions are listed as evidence,
 * every row links to nearblocks.io, and nothing here is typed in by hand.
 */
export interface ProofTx { hash: string; at: number; signer: string; receiver?: string; method: string; summary: string; amount?: string }
export interface Proof {
  generatedAt: number; source: "live" | "snapshot"; network: string; explorer: string; contract: string; owner: string;
  counts: {
    contractTxs: number; okTxs: number; failedTxs: number; jobs: number; minted: number; rejected: number; listings: number; nftSupply: number;
    agentPayments: number; agentPaid: string; funded: string; fees: string; storage: string; sales: number; outsideSales: number; revenue: string;
    ownerTransfers: number; ownerTransferred: string; activeDays: number; firstTxAt: number; lastTxAt: number;
  };
  accounts: { id: string; role: string; balance: string }[];
  days: { day: string; txs: number; jobs: number; mints: number; agentPayments: number }[];
  groups: { funding: ProofTx[]; agentPayments: ProofTx[]; mints: ProofTx[]; listings: ProofTx[]; aiFees: ProofTx[]; sales: ProofTx[]; ownerTransfers: ProofTx[] };
}

const fmt = (y: string | bigint, d = 4) => { const v = BigInt(y); const w = v / 10n ** 24n, f = (v % 10n ** 24n).toString().padStart(24, "0").slice(0, d).replace(/0+$/, ""); return f ? `${w}.${f}` : `${w}`; };

export async function buildProof(): Promise<Proof> {
  const [sw, supply, led] = await Promise.all([view<Swarm>("get_swarm"), view<string>("nft_total_supply"), ledger(500, 0)]);
  const accounts = [
    { id: CONTRACT_ID, role: "Swarm contract (NEP-171 NFTs, budgets, rules)" }, { id: OWNER_ID, role: "Owner: funds the robots, receives the owner share" },
    { id: ROBOT_IDS.curator, role: "Curator robot" }, { id: ROBOT_IDS.painter, role: "Painter robot" }, { id: ROBOT_IDS.critic, role: "Critic robot" },
    { id: ROBOT_IDS.seller, role: "Seller robot" }, { id: TREASURY_ID, role: "Treasury: receives every AI fee" }, { id: GUARDIAN_ID, role: "Guardian: pause only" },
    { id: BOUNTY_ID, role: "Critic's bounty purse" },
  ];
  const balances = await Promise.all(accounts.map((a) => accountBalance(a.id).catch(() => "0")));

  const ok = led.txs.filter((t) => t.ok);
  const g: Proof["groups"] = { funding: [], agentPayments: [], mints: [], listings: [], aiFees: [], sales: [], ownerTransfers: [] };
  let agentPayments = 0, agentPaid = 0n, sales = 0, outsideSales = 0;
  const days = new Map<string, { txs: number; jobs: number; mints: number; agentPayments: number }>();
  for (const t of ok) {
    const day = new Date(t.at).toISOString().slice(0, 10);
    const dd = days.get(day) || { txs: 0, jobs: 0, mints: 0, agentPayments: 0 };
    dd.txs++;
    const base = { hash: t.hash, at: t.at, signer: t.signer, method: t.method };
    for (const e of t.events) {
      const d = e.data || {};
      if (e.event === "funded") g.funding.push({ ...base, amount: d.amount, summary: `${t.signer} funded ${(t.args as any)?.role ? `the ${(t.args as any).role}'s` : "all four robots'"} on-chain budget with ${fmt(d.amount, 3)} NEAR` });
      if (e.event === "agent_paid") { agentPayments++; dd.agentPayments++; agentPaid += BigInt(d.amount); g.agentPayments.push({ ...base, amount: d.amount, summary: `${d.from} paid ${d.to} ${fmt(d.amount, 4)} NEAR for the ${d.for} (job #${d.job_id})` }); }
      if (e.event === "nft_mint") { dd.mints++; g.mints.push({ ...base, summary: `Critic approved and minted NFT #${(d.token_ids || []).join(", ")}` }); }
      if (e.event === "job_opened") dd.jobs++;
      if (e.event === "listed") g.listings.push({ ...base, amount: d.price, summary: `Seller listed NFT #${d.token_id} for ${fmt(d.price, 3)} NEAR` });
      if (e.event === "charged" && BigInt(d.fee || "0") > 0n) g.aiFees.push({ ...base, amount: d.fee, summary: `${d.role} paid a ${fmt(d.fee, 5)} NEAR AI fee to the treasury (${String(d.model || "").split("/").pop()})` });
      if (e.event === "sold") { sales++; if (!isTestBuyer(d.buyer_id)) outsideSales++; g.sales.push({ ...base, amount: d.price, summary: `NFT #${d.token_id} sold to ${d.buyer_id} for ${fmt(d.price, 3)} NEAR${isTestBuyer(d.buyer_id) ? " (our own test account)" : ""}` }); }
    }
    days.set(day, dd);
  }

  // The owner's own NEAR transfers that keep the swarm running (account funding and gas top-ups to its sub-accounts).
  let ownerTransferred = 0n;
  // Only Muse Swarm's own accounts (the owner's other projects share the same root account and are not counted).
  const swarmAccounts = new Set<string>([CONTRACT_ID, ...Object.values(ROBOT_IDS), TREASURY_ID, GUARDIAN_ID, BOUNTY_ID]);
  try {
    const j = await post("/v0/account", { account_id: OWNER_ID });
    const hashes: string[] = (j.account_txs || []).filter((a: any) => a.is_signer || a.is_real_signer).map((a: any) => a.transaction_hash);
    // Read them from the indexer in small batches (raw transfers carry no contract events).
    const chunks: string[][] = [];
    for (let i = 0; i < hashes.length && i < 200; i += 20) chunks.push(hashes.slice(i, i + 20));
    const res = await Promise.all(chunks.map((c) => post("/v0/transactions", { tx_hashes: c })));
    for (const d of res) {
      for (const x of d.transactions || []) {
        const tx = x.transaction;
        const failed = [x.execution_outcome, ...(x.receipts || []).map((r: any) => r.execution_outcome)].some((o: any) => o && "Failure" in (o.outcome?.status || {}));
        if (failed || tx?.signer_id !== OWNER_ID) continue;
        const amt = (tx.actions || []).reduce((a: bigint, act: any) => a + BigInt(act?.Transfer?.deposit || "0"), 0n);
        const created = (tx.actions || []).some((act: any) => act === "CreateAccount" || act?.CreateAccount);
        if (amt > 0n && swarmAccounts.has(tx.receiver_id)) {
          ownerTransferred += amt;
          g.ownerTransfers.push({ hash: tx.hash, at: Number(x.execution_outcome?.block_timestamp || 0) / 1e6, signer: OWNER_ID, receiver: tx.receiver_id, method: created ? "create_account" : "transfer", amount: amt.toString(),
            summary: `${OWNER_ID} sent ${fmt(amt, 3)} NEAR to ${tx.receiver_id}${created ? " (account creation)" : ""}` });
        }
      }
    }
  } catch {}

  const by = (a: ProofTx, b: ProofTx) => b.at - a.at;
  for (const k of Object.keys(g) as (keyof Proof["groups"])[]) g[k].sort(by);
  const times = ok.map((t) => t.at).filter(Boolean);
  return {
    generatedAt: Date.now(), source: "live", network: NETWORK, explorer: EXPLORER, contract: CONTRACT_ID, owner: OWNER_ID,
    counts: {
      contractTxs: led.total, okTxs: ok.length, failedTxs: led.txs.length - ok.length, jobs: sw.stats.jobs, minted: sw.stats.minted, rejected: sw.stats.rejected,
      listings: sw.listings, nftSupply: Number(supply), agentPayments, agentPaid: agentPaid.toString(), funded: sw.stats.funded_total, fees: sw.stats.fees_total,
      storage: sw.stats.storage_total, sales, outsideSales, revenue: sw.stats.revenue_total, ownerTransfers: g.ownerTransfers.length, ownerTransferred: ownerTransferred.toString(),
      activeDays: days.size, firstTxAt: Math.min(...times), lastTxAt: Math.max(...times),
    },
    accounts: accounts.map((a, i) => ({ ...a, balance: balances[i] })),
    days: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, v]) => ({ day, ...v })),
    groups: g,
  };
}

let cache: { t: number; v: Proof } | null = null;
/** Live proof (cached 60 s per instance); falls back to the verified snapshot committed with the code. */
export async function getProof(): Promise<Proof> {
  if (cache && Date.now() - cache.t < 60_000) return cache.v;
  try {
    const v = await Promise.race([buildProof(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("slow")), 20_000))]);
    if (!v.counts.okTxs) throw new Error("empty");
    cache = { t: Date.now(), v };
    return v;
  } catch {
    return { ...(snapshot as unknown as Proof), source: "snapshot" };
  }
}
