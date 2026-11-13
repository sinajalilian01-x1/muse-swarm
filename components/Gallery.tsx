"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { buy, buyOnMarket, onAccount, connect, consumeWalletReturn, walletError } from "@/lib/wallet";
import { toast, who, short, fmtTime } from "@/lib/ui";
import { toNear, mediaUrl, accountUrl, txUrl, EXPLORER, CONTRACT_ID, COLLECTOR_ID, MARKET_ID, isTestBuyer, NETWORK, NET_NAME } from "@/lib/config";
import type { Job } from "@/lib/types";

const n = (y: string) => toNear(y, 3).replace(/\.?0+$/, "") || "0";

interface Venue { venue: string; kind: "direct" | "market"; live: boolean; market?: string; price?: string | null; approvalId?: number | null; url?: string; note?: string }
interface Plan { pitch: string; audience: string; channel: string; best_time: string; hashtags: string[]; why?: string; x_drafts?: string[]; model?: string; ai?: boolean }
interface MarketInfo { owner: string | null; plan: Plan | null; planCid: string | null; venues: Venue[] }

function copy(text: string) { navigator.clipboard?.writeText(text).then(() => toast("Draft copied. Nothing was posted."), () => toast("Copy failed")); }

function MarketPanel({ j, m, acct, busy, onDirect, onMarket }: { j: Job; m?: MarketInfo; acct: string | null; busy: boolean; onDirect: () => void; onMarket: (v: Venue) => void }) {
  if (!m) return <div className="mkt"><span className="k">Loading where it&apos;s for sale…</span></div>;
  const mb = m.venues.find((v) => v.kind === "market");
  const listed = j.status === "listed";
  return (
    <div className="mkt">
      <h4>Where this piece is for sale</h4>
      {listed ? <>
        <div className="venue"><div className="v"><b>Muse Swarm</b><small>direct from {CONTRACT_ID} · {n(j.price)} NEAR</small></div>
          <button className="btn-sm" disabled={busy} onClick={onDirect}>{acct ? "Collect" : "Connect"}</button></div>
        {mb?.live ? <div className="venue"><div className="v"><b>Mintbase market</b><small><a className="lnk" href={mb.url} target="_blank" rel="noreferrer">{short(MARKET_ID, 30)} ↗</a> · {n(mb.price || "0")} NEAR · approval #{mb.approvalId}</small></div>
          <button className="btn-sm ghost" disabled={busy} onClick={() => onMarket(mb)}>{acct ? "Buy via Mintbase" : "Connect"}</button></div>
          : <div className="venue"><div className="v"><b>Mintbase market</b><small>not cross-listed yet. The Seller lists back-catalog works on its next run.</small></div></div>}
      </> : <div className="venue"><div className="v"><b>{j.status === "sold" ? "Sold" : "Not for sale"}</b><small>{j.buyer ? <>owned by <a className="lnk" href={accountUrl(j.buyer)} target="_blank" rel="noreferrer">{isTestBuyer(j.buyer) ? `${short(j.buyer, 24)} (test)` : short(j.buyer, 28)}</a></> : "—"}</small></div></div>}
      <div className="venue"><div className="v"><b>Any NEAR wallet</b><small>NEP-171 token with NEP-177 metadata (title, description, image URL{m.planCid ? ", reference JSON" : ""})</small></div>
        <a className="lnk" href={`${EXPLORER}/nft-token/${CONTRACT_ID}/${j.token_id}`} target="_blank" rel="noreferrer">token ↗</a></div>
      {m.plan ? <>
        <h4>Seller&apos;s marketing plan <span className={`pill ${m.plan.ai ? "ok" : "listed"}`} style={{ marginLeft: 4 }}>{m.plan.ai ? `NEAR AI Cloud · ${(m.plan.model || "").split("/").pop()}` : "fallback marketer"}</span></h4>
        <div className="plan">
          <p>“{m.plan.pitch}”</p>
          <div className="kv2"><span>Audience</span><span>{m.plan.audience}</span><span>Channel</span><span>{m.plan.channel}</span><span>Best time</span><span>{m.plan.best_time}</span></div>
          <div className="tags" style={{ marginTop: 6 }}>{m.plan.hashtags.map((h) => <span key={h}>{h}</span>)}</div>
          {m.plan.why && <p className="k" style={{ marginTop: 6 }}>{m.plan.why}</p>}
        </div>
        {!!m.plan.x_drafts?.length && <>
          <h4>X post drafts · never posted by the app</h4>
          {m.plan.x_drafts.map((d, i) => <div className="draft" key={i}>{d}<div className="row"><span className="k">Draft {i + 1} · {d.length}/280</span><button className="btn-sm ghost" onClick={() => copy(d)}>Copy</button></div></div>)}
        </>}
        <div className="row"><span className="k">Logged on-chain as a marketing_plan event</span>{m.planCid && <a className="lnk" href={`https://gateway.pinata.cloud/ipfs/${m.planCid}`} target="_blank" rel="noreferrer">plan JSON ↗</a>}</div>
      </> : <p className="k">No marketing plan yet{listed ? ": the Seller writes one on its next run." : " (sold before the Seller started marketing)."}</p>}
    </div>
  );
}

export default function Gallery() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [more, setMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "listed" | "sold" | "rejected">("all");
  const [acct, setAcct] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [market, setMarket] = useState<Record<string, MarketInfo>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [receipt, setReceipt] = useState<{ ok: boolean; hash?: string; text: string } | null>(null);
  useEffect(() => onAccount(setAcct), []);
  const load = useCallback(async (before?: string) => {
    try {
      const d = await (await fetch(`/api/jobs?limit=24${before ? `&before=${before}` : ""}`, { cache: "no-store" })).json();
      if (d.error) throw new Error(d.error);
      if (d.jobs) { setJobs((j) => (before ? [...j, ...d.jobs] : d.jobs)); setMore(d.jobs.length === 24); }
      setErr("");
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setLoaded(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const loadMarket = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try { const d = await (await fetch(`/api/market?tokens=${ids.join(",")}`, { cache: "no-store" })).json(); if (d.tokens) setMarket((m) => ({ ...m, ...d.tokens })); } catch {}
  }, []);
  useEffect(() => { const ids = jobs.filter((j) => j.token_id && !(j.token_id in market)).map((j) => j.token_id!); for (let i = 0; i < ids.length; i += 24) loadMarket(ids.slice(i, i + 24)); }, [jobs, loadMarket]); // eslint-disable-line react-hooks/exhaustive-deps
  // Back from a redirect-style wallet: verify the tx on-chain and show a receipt.
  useEffect(() => { consumeWalletReturn().then((r) => { if (!r) return; const split = r.events.find((e) => e.event === "split_paid");
    setReceipt(r.error ? { ok: false, text: r.error } : { ok: r.ok, hash: r.hashes[0], text: r.ok ? (split ? `It's yours! The contract split ${toNear(BigInt(split.data.owner_amount) + split.data.robot_shares.reduce((a: bigint, x: string) => a + BigInt(x), 0n), 3)} NEAR between the owner and the four robots.` : "Transaction confirmed on-chain.") : "The transaction failed on-chain. You were not charged for the NFT." });
    load(); }); }, [load]);
  useEffect(() => { const h = location.hash.match(/job-(\d+)/); if (h && jobs.length) { setOpen((o) => ({ ...o, [h[1]]: true })); setTimeout(() => document.getElementById(`job-${h[1]}`)?.scrollIntoView({ block: "start" }), 50); } }, [jobs.length]);

  const collect = async (j: Job) => {
    if (!acct) { connect(); return; }
    setBusy(j.id);
    try {
      const r = await buy(j.token_id!, j.price);
      if (r?.hash) { setReceipt({ ok: r.ok, hash: r.hash, text: r.ok ? "It's yours! The contract paid the split to the owner and the four robots." : "The purchase failed on-chain." }); toast(r.ok ? "It's yours! Split paid on-chain." : "Purchase failed, see tx"); await load(); }
    } catch (e: any) { toast(walletError(e)); } finally { setBusy(null); }
  };
  const collectOnMarket = async (j: Job, v: Venue) => {
    if (!acct) { connect(); return; }
    setBusy(j.id);
    try {
      const r = await buyOnMarket(j.token_id!, v.price || j.price);
      if (r?.hash) { setReceipt({ ok: r.ok, hash: r.hash, text: r.ok ? "It's yours, bought through the Mintbase market contract. Mintbase called our nft_transfer_payout, and the same on-chain split went to the owner and the four robots." : "The purchase failed on-chain. The market refunds failed offers." }); toast(r.ok ? "Bought via Mintbase. Split paid on-chain." : "Purchase failed, see tx"); await load(); setMarket((m) => { const c = { ...m }; delete c[j.token_id!]; return c; }); }
    } catch (e: any) { toast(walletError(e)); } finally { setBusy(null); }
  };
  const shown = jobs.filter((j) => j.media && (filter === "all" ? true : j.status === filter));
  const counts = { listed: jobs.filter((j) => j.status === "listed").length, sold: jobs.filter((j) => j.status === "sold").length, rejected: jobs.filter((j) => j.status === "rejected").length };
  return (
    <div className="page">
      <h1 className="t">Gallery</h1>
      <p className="sub">Every artwork the swarm made, straight from the contract. Approved works are NEP-171 NFTs minted by <a className="lnk" href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a>. Rejected works stay here too: the Critic scored them under 7.0, so the contract refused to mint them.</p>
      {receipt && <p className="notice" role="status" style={{ marginTop: 14, borderColor: receipt.ok ? "#0E7F7A" : "#B4402F" }}>{receipt.text} {receipt.hash && <a className="lnk" href={txUrl(receipt.hash)} target="_blank" rel="noreferrer">View tx ↗</a>} <button className="btn-sm ghost" onClick={() => setReceipt(null)} aria-label="Dismiss">✕</button></p>}
      {err && <p className="notice" style={{ marginTop: 14 }}>Could not load from {NET_NAME}: {short(err, 120)} <button className="btn-sm ghost" onClick={() => load()}>Retry</button></p>}
      <div className="btn-row">
        {(["all", "listed", "sold", "rejected"] as const).map((f) => <button key={f} className={`btn-sm ${filter === f ? "navy" : "ghost"}`} onClick={() => setFilter(f)}>{f === "all" ? `All (${jobs.filter((j) => j.media).length})` : `${f[0].toUpperCase() + f.slice(1)} (${counts[f]})`}</button>)}
      </div>
      <div className="grid g3 sec">
        {shown.map((j) => (
          <article className="art" key={j.id} id={`job-${j.id}`}>
            <div className="im"><img src={mediaUrl(j.media)} alt={j.title} loading="lazy" /><span className={`pill ${j.status}`}>{j.status}</span></div>
            <div className="meta">
              <b>{j.title}</b>
              <div className="row"><span>Trend: {short(j.trend, 30)}</span><span>#{j.id}</span></div>
              <div className="row"><span>Critic: <b style={{ fontSize: 13, color: j.score >= 70 ? "#0E7F7A" : "#B4402F" }}>{(j.score / 10).toFixed(1)}</b>/10</span>{j.price !== "0" && <span>{n(j.price)} NEAR</span>}</div>
              {j.note && <p className="note" title={j.note}>“{short(j.note.replace(/\s*\([a-z]+ [\d.]+(, [a-z]+ [\d.]+)*\)\s*$/i, ""), 140)}”</p>}
              <div className="row"><span>{fmtTime(Number(j.updated_at_ms))}</span><a className="lnk" href={`https://gateway.pinata.cloud/ipfs/${j.media}`} target="_blank" rel="noreferrer">IPFS ↗</a></div>
              {j.token_id && <div className="row"><a className="lnk" href={`${EXPLORER}/nft-token/${CONTRACT_ID}/${j.token_id}`} target="_blank" rel="noreferrer">NFT {j.token_id} ↗</a>{j.buyer && <a className="lnk" href={accountUrl(j.buyer)} target="_blank" rel="noreferrer">{isTestBuyer(j.buyer) ? <>test buy · {j.buyer === COLLECTOR_ID ? "demo collector" : who(j.buyer).name}</> : <>owner: {who(j.buyer).name}</>}</a>}</div>}
              {j.status === "listed" && <button className="btn-sm" disabled={busy === j.id} onClick={() => collect(j)}>{busy === j.id ? "Confirm in your wallet…" : acct ? `Collect for ${n(j.price)} NEAR` : "Connect wallet to collect"}</button>}
              {j.token_id && <button className="mkt-toggle" aria-expanded={!!open[j.id]} onClick={() => setOpen((o) => ({ ...o, [j.id]: !o[j.id] }))}>{open[j.id] ? "Hide sales & marketing ▴" : `Where it's for sale · marketing plan ▾${market[j.token_id]?.venues.some((v) => v.kind === "market" && v.live) ? " · on Mintbase" : ""}`}</button>}
              {j.token_id && open[j.id] && <MarketPanel j={j} m={market[j.token_id]} acct={acct} busy={busy === j.id} onDirect={() => collect(j)} onMarket={(v) => collectOnMarket(j, v)} />}
            </div>
          </article>
        ))}
      </div>
      {!jobs.length && !err && <p className="sub">{loaded ? "No artworks yet. Run a cycle on the Studio page." : `Loading from ${NET_NAME}…`}</p>}
      {more && jobs.length > 0 && <div className="btn-row"><button className="btn-sm ghost" onClick={() => load(jobs[jobs.length - 1].id)}>Load older works</button></div>}
      <p className="foot2">{NETWORK === "mainnet" ? "NEAR mainnet. Collecting costs real NEAR." : "NEAR testnet. Collecting costs test NEAR only. Get some from the testnet faucet in your wallet."}</p>
    </div>
  );
}
