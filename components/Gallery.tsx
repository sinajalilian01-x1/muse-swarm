"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { buy, onAccount, connect } from "@/lib/wallet";
import { toast, who, short, fmtTime } from "@/lib/ui";
import { toNear, mediaUrl, accountUrl, EXPLORER, CONTRACT_ID, COLLECTOR_ID } from "@/lib/config";
import type { Job } from "@/lib/types";

const n = (y: string) => toNear(y, 3).replace(/\.?0+$/, "") || "0";

export default function Gallery() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [more, setMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "listed" | "sold" | "rejected">("all");
  const [acct, setAcct] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => onAccount(setAcct), []);
  const load = useCallback(async (before?: string) => {
    const d = await (await fetch(`/api/jobs?limit=24${before ? `&before=${before}` : ""}`, { cache: "no-store" })).json();
    if (d.jobs) { setJobs((j) => (before ? [...j, ...d.jobs] : d.jobs)); setMore(d.jobs.length === 24); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = location.hash.match(/job-(\d+)/); if (h && jobs.length) document.getElementById(`job-${h[1]}`)?.scrollIntoView({ block: "center" }); }, [jobs.length]);

  const collect = async (j: Job) => {
    if (!acct) { connect(); return; }
    setBusy(j.id);
    try {
      const r = await buy(j.token_id!, j.price);
      if (r?.hash) { toast(r.ok ? "It's yours! Split paid on-chain." : "Purchase failed, see tx"); await load(); }
    } catch (e: any) { toast(String(e?.message || e)); } finally { setBusy(null); }
  };
  const shown = jobs.filter((j) => j.media && (filter === "all" ? true : j.status === filter));
  const counts = { listed: jobs.filter((j) => j.status === "listed").length, sold: jobs.filter((j) => j.status === "sold").length, rejected: jobs.filter((j) => j.status === "rejected").length };
  return (
    <div className="page">
      <h1 className="t">Gallery</h1>
      <p className="sub">Every artwork the swarm made, straight from the contract. Approved works are NEP-171 NFTs minted by <a className="lnk" href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a>. Rejected works stay here too: the Critic scored them under 7.0, so the contract refused to mint them.</p>
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
              {j.note && <p className="note">“{short(j.note, 140)}”</p>}
              <div className="row"><span>{fmtTime(Number(j.updated_at_ms))}</span><a className="lnk" href={`https://gateway.pinata.cloud/ipfs/${j.media}`} target="_blank" rel="noreferrer">IPFS ↗</a></div>
              {j.token_id && <div className="row"><a className="lnk" href={`${EXPLORER}/nft-token/${CONTRACT_ID}/${j.token_id}`} target="_blank" rel="noreferrer">NFT {j.token_id} ↗</a>{j.buyer && <a className="lnk" href={accountUrl(j.buyer)} target="_blank" rel="noreferrer">owner: {j.buyer === COLLECTOR_ID ? "demo collector" : who(j.buyer).name}</a>}</div>}
              {j.status === "listed" && <button className="btn-sm" disabled={busy === j.id} onClick={() => collect(j)}>{acct ? `Collect for ${n(j.price)} NEAR` : "Connect wallet to collect"}</button>}
            </div>
          </article>
        ))}
      </div>
      {!jobs.length && <p className="sub">Loading from NEAR testnet…</p>}
      {more && jobs.length > 0 && <div className="btn-row"><button className="btn-sm ghost" onClick={() => load(jobs[jobs.length - 1].id)}>Load older works</button></div>}
      <p className="foot2">NEAR testnet. Collecting costs test NEAR only. Get some from the testnet faucet in your wallet.</p>
    </div>
  );
}
