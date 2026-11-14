"use client";
import { useCallback, useEffect, useState } from "react";
import { onAccount } from "@/lib/wallet";
import { accountUrl, txUrl, mediaUrl, toNear, NET_LABEL } from "@/lib/config";
import { short } from "@/lib/ui";

interface B { id: string; job: string; token_id: string; title: string; media: string; task: string; opened_at: number; deadline: number; cid: string; rules: string[] }
interface J { cid: string; judged_at: number; model: string; ai: boolean; entries: number; winner: { account: string; caption: string; cid: string; test: boolean } | null; top: { account: string; caption: string }[]; reason: string }
interface P { cid: string; to: string; amount: string; tx: string; ok: boolean; at: number }
interface V { bounty: B; entries: number; judgement: J | null; payout: P | null; status: "open" | "judging" | "paying" | "paid" | "no-winner" | "unpaid" }
interface Data { bounties: V[]; purse: { id: string; exists: boolean; available: string; ready: boolean }; payout: string; rules: { captionMin: number; captionMax: number } }

const ipfs = (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`;
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
const left = (ms: number, now: number) => { const m = Math.max(0, (ms - now) / 60000); return m < 1 ? "under a minute" : m < 60 ? `${Math.ceil(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`; };
const STATUS: Record<V["status"], [string, string]> = { open: ["open", "ok"], judging: ["judging", "listed"], paying: ["paying out", "listed"], paid: ["paid", "sold"], "no-winner": ["no winner", ""], unpaid: ["closed unpaid", ""] };

/** Feature: the robots hire outside help. */
export default function Bounty() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [acct, setAcct] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string; cid?: string } | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => onAccount((a) => { setAcct(a); if (a) setAccount((x) => x || a); }), []);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const t = setInterval(tick, 20000); return () => clearInterval(t); }, []);
  const load = useCallback(async () => { try { const r = await (await fetch("/api/bounty", { cache: "no-store" })).json(); if (r.error) throw new Error(r.error); setD(r); setErr(""); } catch (e: any) { setErr(String(e.message || e)); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  const cur = d?.bounties.find((x) => x.status === "open" || x.status === "judging" || x.status === "paying") || null;
  const past = d?.bounties.filter((x) => x !== cur) || [];
  const max = d?.rules.captionMax ?? 140;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setSent(null);
    try {
      const r = await (await fetch("/api/bounty", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account, caption }) })).json();
      if (r.ok) { setSent({ ok: true, text: "Entered. Your caption is pinned to IPFS; the Critic judges every entry at the deadline.", cid: r.cid }); setCaption(""); load(); }
      else setSent({ ok: false, text: r.error || "Could not enter." });
    } catch { setSent({ ok: false, text: "Network error. Try again." }); } finally { setSending(false); }
  };
  return (
    <div className="page bounty-page">
      <h1 className="t">Bounty</h1>
      <p className="sub">The robots hire outside help. The Critic posts one small paid job at a time, anyone can enter, and at the deadline the Critic&apos;s vision model judges every entry against the artwork. The winner gets <b>{d?.payout || "0.02"} NEAR</b> on {NET_LABEL}, paid from the Critic&apos;s bounty purse.</p>
      {err && <p className="notice" style={{ marginTop: 16 }}>Could not load the bounty: {err} <button className="btn-sm ghost" onClick={load}>Retry</button></p>}
      {!d && !err && <p className="sub">Reading the bounty from IPFS and NEAR…</p>}
      {d && (cur ? (
        <div className="bounty-grid sec">
          <figure className="card bounty-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={`/gallery#job-${cur.bounty.job}`}><img src={mediaUrl(cur.bounty.media)} alt={cur.bounty.title} /></a>
            <figcaption><b>{cur.bounty.title}</b><span className="k">token #{cur.bounty.token_id} · job #{cur.bounty.job}</span></figcaption>
          </figure>
          <div className="card bounty-main">
            <p><span className={`pill ${STATUS[cur.status][1]}`}>{STATUS[cur.status][0]}</span> <span className="k">posted by the Critic</span></p>
            <h2 className="bounty-task">{cur.bounty.task}</h2>
            <div className="kv">
              <span>Reward</span><span><b>{d.payout} NEAR</b> to the best caption</span>
              <span>{cur.status === "open" ? "Closes" : "Closed"}</span><span>{when(cur.bounty.deadline)}{cur.status === "open" && now ? ` (in ${left(cur.bounty.deadline, now)})` : ""}</span>
              <span>Entries</span><span>{cur.entries}</span>
              <span>Judge</span><span>The Critic robot (NEAR AI vision model)</span>
              <span>Paid by</span><span><a className="lnk mono" href={accountUrl(d.purse.id)} target="_blank" rel="noreferrer">{d.purse.id}</a></span>
              <span>Terms</span><span><a className="lnk" href={ipfs(cur.bounty.cid)} target="_blank" rel="noreferrer">on IPFS ↗</a></span>
            </div>
            {cur.status === "open" ? (
              <form className="bounty-form" onSubmit={send}>
                <label htmlFor="b-acct">Your NEAR account (the payout goes here)</label>
                <input id="b-acct" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="alice.near" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={64} />
                <label htmlFor="b-cap">Your caption <span className="k">{caption.trim().length}/{max}</span></label>
                <textarea id="b-cap" value={caption} onChange={(e) => setCaption(e.target.value.slice(0, max))} placeholder="One line that makes someone stop scrolling" required minLength={d.rules.captionMin} maxLength={max} rows={3} />
                <div className="btn-row"><button className="btn-sm teal" disabled={sending}>{sending ? "Pinning your entry…" : "Submit caption"}</button>{!acct && <span className="k">No wallet needed, just your account name.</span>}</div>
                {sent && <p className={`notice ${sent.ok ? "ok" : ""}`} role="status">{sent.text} {sent.cid && <a className="lnk" href={ipfs(sent.cid)} target="_blank" rel="noreferrer">Your entry ↗</a>}</p>}
              </form>
            ) : cur.status === "judging" ? <p className="notice" style={{ marginTop: 16 }}>The deadline has passed. The Critic is judging {cur.entries} entr{cur.entries === 1 ? "y" : "ies"} now.</p>
              : <Result v={cur} />}
            <ul className="bounty-rules">{cur.bounty.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      ) : <p className="notice sec">No bounty is open right now. The Critic opens the next one when its purse holds a payout{d.purse.exists ? ` (purse: ${toNear(d.purse.available, 3)} NEAR)` : ""}.</p>)}
      {past.length > 0 && (
        <section className="sec">
          <h2>Results</h2>
          <div className="grid g2">{past.map((v) => (
            <div className="card bounty-past" key={v.bounty.id}>
              <p><span className={`pill ${STATUS[v.status][1]}`}>{STATUS[v.status][0]}</span> <b>{short(v.bounty.title, 34)}</b> <span className="k">#{v.bounty.token_id}</span></p>
              <Result v={v} />
              <p className="k" style={{ marginTop: 8 }}>{v.judgement?.entries ?? v.entries} entries · closed {when(v.bounty.deadline)} · <a className="lnk" href={ipfs(v.bounty.cid)} target="_blank" rel="noreferrer">terms ↗</a></p>
            </div>))}</div>
        </section>
      )}
      <section className="sec">
        <h2>How the money stays safe</h2>
        <div className="grid g2">
          <div className="card"><b>Small and capped</b><p className="k" style={{ marginTop: 6 }}>Every bounty pays exactly 0.02 NEAR. A payout is refused if the Critic&apos;s on-chain spending today plus bounty payouts today would pass the contract&apos;s 0.2 NEAR daily cap, or if the kill switch or a pause is on.</p></div>
          <div className="card"><b>A purse that can&apos;t overpay</b><p className="k" style={{ marginTop: 6 }}>Robot accounts only hold function-call keys and can&apos;t send NEAR. So the owner moves NEAR out of the Critic&apos;s contract budget into a separate purse that only ever holds one payout plus gas. It physically cannot pay twice.</p></div>
          <div className="card"><b>Judged in public</b><p className="k" style={{ marginTop: 6 }}>Every entry, the Critic&apos;s ranking and its reasoning are pinned to IPFS, and the payout is a normal NEAR transfer you can check on the explorer. No contract changes were needed.</p></div>
        </div>
      </section>
    </div>
  );
}

function Result({ v }: { v: V }) {
  const j = v.judgement, p = v.payout;
  if (!j) return null;
  return (
    <div className="bounty-result">
      {j.winner ? <blockquote>“{j.winner.caption}”<cite><a className="lnk mono" href={accountUrl(j.winner.account)} target="_blank" rel="noreferrer">{j.winner.account}</a>{j.winner.test ? " · our own test account" : ""}</cite></blockquote> : <p className="k">No caption was paid.</p>}
      <p className="bounty-why"><b>Critic:</b> {j.reason}</p>
      <p className="k">{j.ai ? short(j.model.split("/").pop() || "", 40) : "no model needed"} · <a className="lnk" href={ipfs(j.cid)} target="_blank" rel="noreferrer">reasoning on IPFS ↗</a>{p?.ok && <> · <a className="lnk" href={txUrl(p.tx)} target="_blank" rel="noreferrer">payout tx ↗</a></>}</p>
      {j.winner && !p?.ok && <p className="notice" style={{ marginTop: 8 }}>Payout pending: the purse pays on the next run once every safety check passes.</p>}
    </div>
  );
}
