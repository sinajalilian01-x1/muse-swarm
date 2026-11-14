import { getProof, type ProofTx } from "@/lib/proof";
import { toNear } from "@/lib/config";

export const metadata = { title: "Mainnet proof · Muse Swarm", description: "Real NEAR mainnet evidence: the agent accounts, the contract, and every agent payment, mint, listing and funding transaction, linked to nearblocks.io." };
export const revalidate = 60;
export const maxDuration = 60;

const n = (y: string, d = 4) => toNear(y, d).replace(/\.?0+$/, "") || "0";
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/Budapest", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " CET";

function Txs({ title, note, rows, explorer, max = 10 }: { title: string; note: string; rows: ProofTx[]; explorer: string; max?: number }) {
  return (
    <section className="card sec proof-sec">
      <h2>{title} <span className="k">({rows.length})</span></h2>
      <p className="k">{note}</p>
      {rows.length ? (
        <table className="tx"><thead><tr><th>When</th><th>What happened</th><th>Tx</th></tr></thead><tbody>
          {rows.slice(0, max).map((t, i) => (
            <tr key={t.hash + i}><td data-label="When" className="k" style={{ whiteSpace: "nowrap" }}>{when(t.at)}</td><td data-label="What">{t.summary} <span className="pill ok">success</span></td>
              <td data-label="Transaction"><a className="lnk mono" href={`${explorer}/txns/${t.hash}`} target="_blank" rel="noreferrer">{t.hash.slice(0, 8)}… ↗</a></td></tr>))}
        </tbody></table>
      ) : <p className="notice">None yet.</p>}
      {rows.length > max && <p className="k">Showing the newest {max} of {rows.length}. All of them are in the <a className="lnk" href="/ledger">Ledger</a> and at <a className="lnk" href="/api/proof">/api/proof</a>.</p>}
    </section>
  );
}

export default async function Page() {
  const p = await getProof();
  const c = p.counts;
  const acct = (id: string) => `${p.explorer}/address/${id}`;
  return (
    <div className="page proof">
      <h1 className="t">Mainnet proof</h1>
      <p className="sub">Muse Swarm runs on <b>NEAR mainnet</b> with real NEAR. Everything on this page is read from public chain data (NEAR RPC and the FastNEAR transaction indexer){p.source === "live" ? ", live" : ", from a snapshot verified against mainnet RPC"}, and every row links to nearblocks.io. Only successful transactions are listed. Updated {when(p.generatedAt)}.</p>

      <div className="proof-stats">
        {[
          [c.contractTxs, "mainnet txs on the swarm contract", `${c.failedTxs} failed`],
          [c.jobs, "jobs run by the robots", `${c.rejected} rejected by the Critic`],
          [c.nftSupply, "NFTs minted (NEP-171)", `${c.listings} listed for sale`],
          [c.agentPayments, "agent→agent payments", `${n(c.agentPaid)} NEAR robot to robot`],
          [`${n(c.funded, 2)} NEAR`, "funded into robot budgets", "by the owner, on-chain"],
          [`${n(c.fees, 3)} NEAR`, "AI fees paid to the treasury", `${n(c.storage, 3)} NEAR storage paid`],
          [c.activeDays, "days with on-chain activity", `last tx ${when(c.lastTxAt)}`],
          [c.outsideSales, "sales to outside buyers", c.sales ? `${c.sales} sales in total` : "no sales yet"],
        ].map(([v, l, s], i) => <div className="card stat" key={i}><b>{v}</b><span>{l}</span><i className="k">{s}</i></div>)}
      </div>

      <section className="card sec proof-sec">
        <h2>Accounts</h2>
        <p className="k">The contract and the robots are sub-accounts of the owner&apos;s mainnet account. Robots hold function-call keys only, so they can call their own contract method and nothing else.</p>
        <table className="tx"><thead><tr><th>Account</th><th>Role</th><th>Balance</th></tr></thead><tbody>
          {p.accounts.map((a) => <tr key={a.id}><td data-label="Account"><a className="lnk mono" href={acct(a.id)} target="_blank" rel="noreferrer">{a.id} ↗</a></td><td data-label="Role">{a.role}</td><td data-label="Balance" className="mono">{n(a.balance, 3)} NEAR</td></tr>)}
        </tbody></table>
      </section>

      <section className="card sec proof-sec">
        <h2>Activity by day (UTC)</h2>
        <table className="tx"><thead><tr><th>Day</th><th>Txs</th><th>Jobs opened</th><th>NFTs minted</th><th>Agent payments</th></tr></thead><tbody>
          {p.days.map((d) => <tr key={d.day}><td data-label="Day" className="mono">{d.day}</td><td data-label="Txs">{d.txs}</td><td data-label="Jobs">{d.jobs}</td><td data-label="Mints">{d.mints}</td><td data-label="Agent payments">{d.agentPayments}</td></tr>)}
        </tbody></table>
      </section>

      <Txs title="Agent→agent payments" note="Robots paying each other from their own on-chain budgets: the Painter pays the Curator for each brief, the Seller pays the Critic for each appraisal." rows={p.groups.agentPayments} explorer={p.explorer} />
      <Txs title="NFT mints" note="The Critic robot approves a work (score ≥ 7.0) and the contract mints it as a NEP-171 NFT in the same transaction." rows={p.groups.mints} explorer={p.explorer} />
      <Txs title="Listings" note="The Seller robot prices each minted work inside the owner's floor and max and lists it for sale (and on Mintbase's market)." rows={p.groups.listings} explorer={p.explorer} />
      <Txs title="AI fees paid on-chain" note="Each robot pays its NEAR AI inference fee from its budget to the treasury account." rows={p.groups.aiFees} explorer={p.explorer} max={6} />
      <Txs title="Owner funding of robot budgets" note="Real NEAR the owner put into the robots' on-chain budgets with the contract's payable fund()." rows={p.groups.funding} explorer={p.explorer} />
      <Txs title="Owner transfers to the swarm's accounts" note="Account creation and gas top-ups from the owner's wallet to the robot, treasury, guardian and bounty accounts." rows={p.groups.ownerTransfers} explorer={p.explorer} />
      <Txs title="Sales" note="Sales of the swarm's NFTs. Buys by the owner's own accounts would be labeled as test buys." rows={p.groups.sales} explorer={p.explorer} />

      <p className="foot2">Contract: <a className="lnk mono" href={acct(p.contract)} target="_blank" rel="noreferrer">{p.contract}</a> · Owner: <a className="lnk mono" href={acct(p.owner)} target="_blank" rel="noreferrer">{p.owner}</a> · JSON: <a className="lnk" href="/api/proof">/api/proof</a> · Data source: {p.source}.</p>
    </div>
  );
}
