"use client";
import { useEffect, useState } from "react";
import { ROBOT_META } from "@/lib/config";
import { who, label, txUrl, short } from "@/lib/ui";

interface Thought { id: string; role: keyof typeof ROBOT_META | "buyer"; verdict: string; text: string; reason?: string; model?: string; ai?: boolean; tx: string; at: number; job?: string; doc?: string }
interface Tok { job: string; title: string; status: string; palette: string | null; price: number; views: number; clicks: number; collects: number; sold: boolean; markdowns: number; listedHours: number }
interface Learned { status: "learning" | "learned"; summary: string; lessons: { kind: string; text: string }[]; totals: { views: number; clicks: number; collects: number; sales: number; markdowns: number; listings: number }; tokens: Tok[]; signalsSince: number | null; rules: { minViews: number }; hash: string }
export interface FreshTx { hash: string; signer: string; method?: string; ok: boolean; error?: string }

const ago = (ms: number, now: number) => { if (!now) return ""; const s = Math.max(0, (now - ms) / 1000); return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
const tone = (t: Thought) => (/rejected/.test(t.verdict) ? "bad" : /minted|sold|listed|delivered/.test(t.verdict) ? "good" : /marked down|test/.test(t.verdict) ? "warn" : "");

/** Feature: live reasoning. Every robot's real decision and the reason it gave, straight from its signed tx and the IPFS docs it points to. */
export default function Reasoning({ fresh, bump, acct }: { fresh: FreshTx[]; bump: number; acct: string | null }) {
  const [tab, setTab] = useState<"why" | "learned">("why");
  const [items, setItems] = useState<Thought[] | null>(null);
  const [err, setErr] = useState(false);
  const [learned, setLearned] = useState<Learned | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => { const tick = () => setNow(Date.now()); tick(); const t = setInterval(tick, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const d = await (await fetch("/api/feed?limit=12", { cache: "no-store" })).json(); if (!alive) return; if (d.items) { setItems(d.items); setErr(false); } else setErr(true); } catch { if (alive) setErr(true); } };
    load(); const t = setInterval(load, 15000);
    const later = bump ? [setTimeout(load, 2500), setTimeout(load, 7000)] : [];
    return () => { alive = false; clearInterval(t); later.forEach(clearTimeout); };
  }, [bump]);
  useEffect(() => {
    if (tab !== "learned") return;
    let alive = true;
    const load = async () => { try { const d = await (await fetch("/api/learned", { cache: "no-store" })).json(); if (alive && !d.error) setLearned(d); } catch {} };
    load(); const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [tab]);
  const pending = fresh.filter((f) => !items?.some((i) => i.tx === f.hash)).slice(0, 2);
  const top = learned ? [...learned.tokens].sort((a, b) => b.views + b.clicks * 3 - (a.views + a.clicks * 3) || Number(b.job) - Number(a.job)).slice(0, 5) : [];
  return (
    <section className="feed think-feed" aria-label="What the robots are thinking">
      <div className="tf-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "why"} className={tab === "why" ? "on" : ""} onClick={() => setTab("why")}>Robot reasoning<i className="live-dot" /></button>
        <button role="tab" aria-selected={tab === "learned"} className={tab === "learned" ? "on" : ""} onClick={() => setTab("learned")}>What the swarm learned</button>
        <a href="/ledger">Ledger →</a>
      </div>
      {tab === "why" ? (
        <ul className="tf-list" aria-live="polite">
          {pending.map((t) => { const w = who(t.signer === "you" ? acct || "you" : t.signer); return (
            <li key={t.hash} className="tf new"><span className="tf-av" style={{ ["--c" as any]: w.color }} /><div className="tf-b"><p className="tf-h"><b>{w.name}</b><em>{t.ok ? label(t.method) : "failed"}</em></p><p className="tf-r">{t.ok ? "Reading its reasoning from the chain…" : short(t.error || "", 60)}</p><p className="tf-f"><a href={txUrl(t.hash)} target="_blank" rel="noreferrer">tx ↗</a></p></div></li>); })}
          {(items || []).map((t, i) => { const meta = t.role === "buyer" ? { name: "Buyer", color: "#13243F" } : ROBOT_META[t.role]; return (
            <li key={t.id} className={`tf ${i < 1 && now - t.at < 120_000 ? "new" : ""}`}>
              <span className="tf-av" style={{ ["--c" as any]: meta.color }} aria-hidden="true" />
              <div className="tf-b" style={{ ["--c" as any]: meta.color }}>
                <p className="tf-h"><b>{meta.name}</b><em data-t={tone(t)}>{t.verdict}</em></p>
                <p className="tf-t">{t.text}</p>
                {t.reason && <p className="tf-r">{t.role === "critic" ? "“" : ""}{t.reason}{t.role === "critic" ? "”" : ""}</p>}
                <p className="tf-f">{t.job && <a href={`/gallery#job-${t.job}`}>job #{t.job}</a>}{t.model && <span title={t.ai ? "NEAR AI Cloud model" : "labeled fallback"}>{t.ai ? t.model : t.model.replace(/^fallback-/, "fallback ")}</span>}{t.doc && <a href={`https://gateway.pinata.cloud/ipfs/${t.doc}`} target="_blank" rel="noreferrer">why (IPFS) ↗</a>}<span>{ago(t.at, now)}</span><a href={txUrl(t.tx)} target="_blank" rel="noreferrer">tx ↗</a></p>
              </div>
            </li>); })}
          {!items && !err && <li className="tf-empty">Reading the robots&apos; decisions from NEAR…</li>}
          {err && !items && <li className="tf-empty">Could not reach the chain indexer. Retrying…</li>}
        </ul>
      ) : (
        <div className="tf-learn">
          {!learned ? <p className="tf-empty">Reading signals and sales…</p> : <>
            <p className="tf-status"><span className={`pill ${learned.status === "learned" ? "ok" : "listed"}`}>{learned.status === "learned" ? "learned" : "learning"}</span>{learned.status === "learning" ? "Learning, not enough data yet" : "Steering the next job"}</p>
            <p className="tf-sum">{learned.status === "learning" ? `${learned.totals.views} real gallery view${learned.totals.views === 1 ? "" : "s"} so far. Style lessons start at ${learned.rules.minViews}.` : learned.lessons.filter((l) => l.kind !== "price").map((l) => l.text).join(" ")}</p>
            {learned.lessons.filter((l) => l.kind === "price").map((l) => <p className="tf-sum" key={l.text}>{l.text}</p>)}
            <div className="tf-totals"><span><b>{learned.totals.views}</b>views</span><span><b>{learned.totals.clicks}</b>detail clicks</span><span><b>{learned.totals.collects}</b>Collect clicks</span><span><b>{learned.totals.sales}</b>sales</span><span><b>{learned.totals.markdowns}</b>markdowns</span></div>
            <table className="tf-tok"><thead><tr><th>Work</th><th>Views</th><th>Clicks</th><th>Listed</th><th>Price</th></tr></thead><tbody>
              {top.map((t) => <tr key={t.job}><td><a href={`/gallery#job-${t.job}`}>{short(t.title, 22)}</a>{t.palette && <small>{t.palette}</small>}</td><td>{t.views}</td><td>{t.clicks + t.collects}</td><td>{t.sold ? "sold" : t.listedHours < 48 ? `${Math.round(t.listedHours)} h` : `${Math.round(t.listedHours / 24)} d`}</td><td>{t.price}</td></tr>)}
            </tbody></table>
            <p className="tf-note">Real visitors only (bots and our own tests are ignored). Sales and markdowns come from the chain. Before each job, the Curator reads this, and its decision goes to IPFS. The CID is written on-chain in the job brief.</p>
          </>}
        </div>
      )}
    </section>
  );
}
