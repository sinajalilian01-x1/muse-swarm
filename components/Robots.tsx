"use client";
import { useCallback, useEffect, useState } from "react";
import { toast, short } from "@/lib/ui";
import { fund, onAccount, connect, consumeWalletReturn, walletError } from "@/lib/wallet";
import { toNear, txUrl, accountUrl, ROBOT_META, ROLES, CONTRACT_ID, OWNER_ID, TREASURY_ID, GUARDIAN_ID, COLLECTOR_ID, BOUNTY_ID, NET_NAME, NETWORK } from "@/lib/config";

const n = (y: string | bigint, d = 4) => toNear(String(y), d).replace(/\.?0+$/, "") || "0";
const pct = (a: string, b: string) => Math.min(100, Number((BigInt(a) * 10000n) / (BigInt(b) || 1n)) / 100);
function KeyList({ keys }: { keys: any[] }) {
  return (<ul style={{ listStyle: "none", padding: 0, marginTop: 8, display: "grid", gap: 4 }}>
    {keys.map((k) => { const fc = k.permission?.FunctionCall; return (
      <li key={k.public_key} className="k" style={{ fontSize: 12 }}>
        <span className={`pill ${fc ? "ok" : "fail"}`}>{fc ? "function-call" : "full access"}</span>{" "}
        <span className="mono">{short(k.public_key, 22)}</span>
        {fc && <> → {fc.receiver_id} · {(fc.method_names || []).join(", ") || "any method"} · allowance {fc.allowance ? `${n(fc.allowance, 3)} NEAR` : "unlimited"}</>}
      </li>); })}
  </ul>);
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
function repLine(r: string, rep: any) {
  if (!rep) return "…";
  if (r === "curator") return `${pc(rep.curator.hitRate)} of its picks passed the Critic · ${rep.curator.sources} trend sources`;
  if (r === "painter") return `avg score ${rep.painter.avgScore.toFixed(1)}/10 · best ${rep.painter.best.toFixed(1)}`;
  if (r === "critic") return `${rep.critic.reviews} reviews · approves ${pc(rep.critic.approvalRate)} · rejected ${rep.critic.rejected}`;
  return `${pc(rep.seller.sellThrough)} sell-through · avg sale ${rep.seller.avgPrice.toFixed(3)} NEAR`;
}
function gigLine(r: string, g: any) {
  if (!g) return "…";
  const x = g[r];
  if (r === "curator") return `earned ${n(x.earned, 4)} NEAR from the Painter for ${x.count} briefs`;
  if (r === "critic") return `earned ${n(x.earned, 4)} NEAR from the Seller for ${x.count} appraisals`;
  if (r === "painter") return `paid the Curator ${n(x.paid, 4)} NEAR for briefs`;
  return `paid the Critic ${n(x.paid, 4)} NEAR for appraisals`;
}

export default function Robots() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(""); const [pausing, setPausing] = useState(false);
  const [acct, setAcct] = useState<string | null>(null); const [backing, setBacking] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ ok: boolean; hash?: string; text: string } | null>(null);
  useEffect(() => onAccount(setAcct), []);
  useEffect(() => { consumeWalletReturn().then((r) => { if (r) setReceipt(r.error ? { ok: false, text: r.error } : { ok: r.ok, hash: r.hashes[0], text: r.ok ? "Thanks, patron! The NEAR is now in that robot's on-chain budget." : "The transaction failed on-chain." }); }); }, []);
  const back = async (role: string) => {
    if (!acct) { connect(); toast(`Connect a ${NET_NAME} wallet to back a robot.`); return; }
    setBacking(role);
    try { const r = await fund(role, "0.1"); if (r?.hash) { setReceipt({ ok: r.ok, hash: r.hash, text: r.ok ? "Thanks, patron! 0.1 NEAR is now in that robot's on-chain budget." : "The transaction failed on-chain." }); load(); } }
    catch (e) { toast(walletError(e), 4500); } finally { setBacking(null); }
  };
  const load = useCallback(async () => { try { const r = await (await fetch("/api/robots", { cache: "no-store" })).json(); if (r.error) throw new Error(r.error); setD(r); setErr(""); } catch (e: any) { setErr(String(e.message || e)); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const pause = async () => {
    setPausing(true);
    const r = await (await fetch("/api/swarm/pause", { method: "POST" })).json().catch(() => ({}));
    setPausing(false);
    if (r.tx?.hash) { toast(r.tx.ok ? "Paused on-chain by the guardian. It auto-releases in 45 s." : `Pause failed: ${r.tx.error}`); load(); }
    else toast(r.error || "Could not pause");
  };
  const s = d?.swarm, st = s?.stats, rules = s?.rules;
  const acc = (id: string) => d?.accounts?.find((a: any) => a.id === id);
  const gasAll = d ? Object.values(d.gasBurntBySigner as Record<string, string>).reduce((a, b) => a + BigInt(b), 0n) : 0n;
  const robotGas = d ? ROLES.reduce((a, r) => a + BigInt(d.gasBurntBySigner[s.robots[ROLES.indexOf(r)].account_id] || "0"), 0n) : 0n;
  const robotsEarned = st ? BigInt(st.robots_earned_total) : 0n;
  const costs = st ? BigInt(st.fees_total) + BigInt(st.storage_total) + robotGas : 0n;
  const net = robotsEarned - costs;
  const pausedUntil = s ? Number(s.paused_until_ms) : 0;
  return (
    <div className="page">
      <h1 className="t">The robots</h1>
      <p className="sub robots-lede">Agents that hire each other: on every job the Painter pays the Curator for the brief and the Seller pays the Critic for the appraisal, budget to budget inside the contract. Four NEAR accounts that only hold <b>function-call keys</b>: each key can call just its own method on <a className="lnk" href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a> (plus refueling gas from its own budget). They can&apos;t transfer NEAR, deploy code or touch each other. The contract enforces the owner&apos;s rules on every call.</p>
      {receipt && <p className="notice" role="status" style={{ marginTop: 14 }}>{receipt.text} {receipt.hash && <a className="lnk" href={txUrl(receipt.hash)} target="_blank" rel="noreferrer">View tx ↗</a>}</p>}
      {err && <p className="notice" style={{ marginTop: 16 }}>Could not load chain data: {err} <button className="btn-sm ghost" onClick={load}>Retry</button></p>}
      {!d && !err && <p className="sub">Reading accounts and keys from {NET_NAME}…</p>}
      {d && <>
        <div className="grid robots-grid sec">
          {ROLES.map((r, i) => { const m = ROBOT_META[r], rb = s.robots[i], a = acc(rb.account_id); return (
            <div className="card" key={r}>
              <div className="robot-h"><div className="av" style={{ background: m.color }}>{m.name[0]}</div><div><b style={{ fontSize: 18 }}>{m.name}</b><div className="k">{m.job}</div></div></div>
              <div className="kv">
                <span>Account</span><a className="lnk mono" href={accountUrl(rb.account_id)} target="_blank" rel="noreferrer">{rb.account_id}</a>
                <span>Wallet (gas)</span><span>{n(a?.balance || "0", 3)} NEAR</span>
                <span>Budget in contract</span><span>{n(rb.budget, 4)} NEAR <span className="k">(cap {n(rules.budget_cap, 2)}, extra is swept to the owner)</span></span>
                <span>Spent today</span><span>{n(rb.spent_today, 4)} / {n(rules.daily_cap, 2)} NEAR<div className="bar" style={{ ["--c" as any]: m.color }}><i style={{ width: `${pct(rb.spent_today, rules.daily_cap)}%` }} /></div></span>
                <span>Earned from sales</span><span>{n(rb.earned_total)} NEAR ({s.rules.split[r] / 100}% of each sale)</span>
                <span>AI fees paid</span><span>{n(rb.fees_total, 5)} NEAR → treasury</span>
                <span>Storage paid</span><span>{n(rb.storage_total, 5)} NEAR</span>
                <span>Gas refuels</span><span>{n(rb.refuel_total, 3)} NEAR</span>
                <span>Gas burned</span><span>{n(d.gasBurntBySigner[rb.account_id] || "0", 5)} NEAR</span>
                <span>Actions</span><span>{rb.actions}</span>
                <span>Track record</span><span>{repLine(r, d.reputation)}</span>
                <span>Agent-to-agent</span><span>{gigLine(r, d.gigs)}</span>
              </div>
              <KeyList keys={a?.keys || []} />
              <div className="btn-row"><button className="btn-sm ghost" disabled={backing === r} onClick={() => back(r)} title="Calls the contract's payable fund(role) from your wallet">{backing === r ? "Confirm in your wallet…" : `Back the ${m.name} with 0.1 NEAR`}</button></div>
            </div>); })}
        </div>
        <p className="foot2">Anyone can be a patron: <span className="mono">fund(role)</span> is payable and public, so your NEAR goes straight into that robot&apos;s on-chain budget, which it spends on AI fees, storage and gas within the owner&apos;s caps.</p>

        <section className="sec">
          <h2>Swarm P&amp;L <span className="pill">honest numbers</span></h2>
          <div className="pnl">
            <div><b>{n(st.revenue_total, 3)}</b><span>NEAR sales revenue ({st.sold} sold)</span></div>
            <div><b>{n(d.revenue.external, 3)}</b><span>from outside wallets (excludes {NETWORK === "mainnet" ? "our own test accounts" : "our demo collector and test accounts"})</span></div>
            <div><b>{n(st.owner_paid_total, 3)}</b><span>paid to the owner ({rules.split.owner / 100}% + sweeps)</span></div>
            <div><b>{n(robotsEarned, 3)}</b><span>robots earned (shares)</span></div>
            <div><b>{n(st.fees_total, 4)}</b><span>AI fees → treasury</span></div>
            <div><b>{n(st.storage_total, 4)}</b><span>storage paid for jobs + NFTs</span></div>
            <div><b>{n(robotGas, 4)}</b><span>gas burned by the robots</span></div>
            <div><b style={{ color: net >= 0n ? "var(--ok-ink,#0E7F7A)" : "var(--bad-ink,#B4402F)" }}>{net < 0n ? "−" : ""}{n(net < 0n ? -net : net, 4)}</b><span>robots net (earned − fees − storage − gas)</span></div>
          </div>
          <p className="notice" style={{ marginTop: 14 }}>{NETWORK === "mainnet" ? <>Buys by our own accounts ({OWNER_ID} and its sub-accounts) are labeled test and are <b>not</b> real demand.</> : <>Most sales so far are made by <b>{COLLECTOR_ID}</b>, our testnet demo collector, so visitors without a wallet can see the full loop. That is the owner&apos;s own money going round, so it is <b>not</b> real demand. Our own test buyers (accounts under museswarm.testnet) are excluded too.</>} Only the &ldquo;outside wallets&rdquo; number counts as real demand. {d.revenue.sampleJobs < st.jobs ? `(Revenue split by buyer covers the latest ${d.revenue.sampleJobs} jobs.)` : ""} Gas for all swarm txs (incl. owner &amp; buyers): {n(gasAll, 4)} NEAR.</p>
        </section>

        <section className="sec">
          <h2>Owner rules (enforced by the contract)</h2>
          <div className="grid g4">
            <div className="card"><div className="k">Price floor / max</div><b>{n(rules.floor, 3)} – {n(rules.max_price, 3)} NEAR</b></div>
            <div className="card"><div className="k">Mint threshold</div><b>Critic score ≥ {(rules.score_threshold / 10).toFixed(1)}</b></div>
            <div className="card"><div className="k">Daily spend cap per robot</div><b>{n(rules.daily_cap, 3)} NEAR</b></div>
            <div className="card"><div className="k">Max AI fee per action</div><b>{n(rules.fee_cap, 3)} NEAR</b></div>
            <div className="card"><div className="k">Budget cap per robot</div><b>{n(rules.budget_cap, 3)} NEAR</b></div>
            <div className="card"><div className="k">Jobs per day</div><b>{st.jobs_today} / {rules.max_jobs_per_day}</b></div>
            <div className="card"><div className="k">Sale split</div><b>owner {rules.split.owner / 100}% · curator {rules.split.curator / 100}% · painter {rules.split.painter / 100}% · critic {rules.split.critic / 100}% · seller {rules.split.seller / 100}%</b></div>
            <div className="card"><div className="k">Status</div><b>{s.kill_switch ? "Kill switch ON" : !s.live ? `Paused until ${new Date(pausedUntil).toLocaleTimeString()}` : "Live"}</b></div>
          </div>
        </section>

        <section className="sec">
          <h2>Kill switch</h2>
          <div className="card">
            <p style={{ lineHeight: 1.5 }}>The owner&apos;s <span className="mono">set_kill_switch</span> stops every robot action until the owner turns it off (it needs the owner&apos;s own wallet). For demo visitors there is a <b>guardian pause</b>: the guardian account&apos;s only key can call <span className="mono">guardian_pause</span>, which the contract caps at 120 s, so it always releases itself. Try it: robots will be refused on-chain for 45 seconds.</p>
            <div className="btn-row"><button className="btn-sm navy" disabled={pausing} onClick={pause}>{pausing ? "Pausing…" : "Pause the swarm for 45 s"}</button></div>
          </div>
        </section>

        <section className="sec">
          <h2>Other accounts</h2>
          <div className="grid g2">
            {[[CONTRACT_ID, "Swarm contract", "Holds rules, budgets, jobs and the NFTs. Robots' budgets live here."], [OWNER_ID, "Owner", "Sets rules, funds and withdraws, gets the owner share. Its full key never touches the server."], [TREASURY_ID, "Treasury", "Receives every AI fee, so nothing gets stranded on function-call-only robot accounts."], [GUARDIAN_ID, "Guardian", "Can only pause the swarm for up to 120 s."], [BOUNTY_ID, "Critic's bounty purse", "Pays outside helpers who win a bounty. Funded from the Critic's contract budget with one 0.02 NEAR payout plus gas at a time, so its server-side key can never lose more than that."], ...(NETWORK === "mainnet" ? [] : [[COLLECTOR_ID, "Demo collector", "Testnet buyer for visitors without a wallet. Max 0.25 NEAR per buy, rate-limited."]])].map(([id, t, txt]) => { const a = acc(id); return (
              <div className="card" key={id}><b>{t}</b> · <a className="lnk mono" href={accountUrl(id)} target="_blank" rel="noreferrer">{id}</a><div className="k" style={{ marginTop: 4 }}>{txt} Balance {n(a?.balance || "0", 3)} NEAR.</div><KeyList keys={a?.keys || []} /></div>); })}
          </div>
        </section>
        <p className="foot2">All live from {NET_NAME}: view calls, access-key lists and the tx ledger ({d.ledgerTxs} txs).</p>
      </>}
    </div>
  );
}
