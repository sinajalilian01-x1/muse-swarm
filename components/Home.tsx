/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { buy as walletBuy, onAccount, connect, consumeWalletReturn, walletError } from "@/lib/wallet";
import { toast, who, label, txUrl, short } from "@/lib/ui";
import { toNear } from "@/lib/config";

interface Latest { img: string; title: string; price: string | number; status: "listed" | "sold"; buyer?: string; tokenId?: string | null; jobId?: string; priceY?: string }
interface FeedTx { hash: string; signer: string; method?: string; ok: boolean; error?: string; fresh?: boolean }

let mounted = false;

export default function Home() {
  const stage = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
  const dir = useRef<any>(null), studio = useRef<any>(null);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [stats, setStats] = useState({ minted: 0, sold: 0, revenue: "0", live: true, jobs: 0 });
  const [mode, setMode] = useState<{ mode: string; jobId: string | null; running: boolean }>({ mode: "idle", jobId: null, running: false });
  const [status, setStatus] = useState("");
  const [autoSell, setAutoSell] = useState(true);
  const [feed, setFeed] = useState<FeedTx[]>([]);
  const [acct, setAcct] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [fs, setFs] = useState(false);

  const nativeFsEl = () => document.fullscreenElement || (document as any).webkitFullscreenElement || null;
  const requestNativeFs = (el: HTMLElement) => {
    const fn = el.requestFullscreen || (el as any).webkitRequestFullscreen || (el as any).webkitRequestFullScreen;
    return fn ? Promise.resolve(fn.call(el)).then(() => true).catch(() => false) : Promise.resolve(false);
  };
  const exitNativeFs = () => {
    const fn = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).webkitCancelFullScreen;
    return fn ? Promise.resolve(fn.call(document)).catch(() => {}) : Promise.resolve();
  };
  const syncVpVars = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const r = document.documentElement.style;
    r.setProperty("--vvw", `${vv.width}px`);
    r.setProperty("--vvh", `${vv.height}px`);
    r.setProperty("--vvt", `${vv.offsetTop}px`);
    r.setProperty("--vvl", `${vv.offsetLeft}px`);
  };
  const bumpResize = () => { studio.current?.studio?.resize?.(); window.dispatchEvent(new Event("resize")); };
  const applyPseudoFs = (on: boolean) => {
    document.body.classList.toggle("room-fs", on);
    stage.current?.classList.toggle("is-fs", on);
    setFs(on);
    if (on) syncVpVars();
    requestAnimationFrame(bumpResize);
  };
  const enterFs = async () => {
    const el = stage.current; if (!el) return;
    if ((await requestNativeFs(el)) && nativeFsEl()) return;
    applyPseudoFs(true);
  };
  const exitFs = async () => {
    if (nativeFsEl()) { await exitNativeFs(); return; }
    applyPseudoFs(false);
  };
  const toggleFs = () => { if (fs || nativeFsEl() || document.body.classList.contains("room-fs")) exitFs(); else enterFs(); };


  const pushTx = useCallback((t: FeedTx) => setFeed((f) => [{ ...t, fresh: true }, ...f.filter((x) => x.hash !== t.hash).map((x) => ({ ...x, fresh: false }))].slice(0, 5)), []);
  const loadFeed = useCallback(async () => {
    try { const d = await (await fetch("/api/ledger?limit=5", { cache: "no-store" })).json(); if (d.txs) setFeed((f) => { const fresh = f.filter((x) => x.fresh); const rest = d.txs.map((t: any) => ({ hash: t.hash, signer: t.signer, method: t.method, ok: t.ok, error: t.error })); return [...fresh, ...rest.filter((r: FeedTx) => !fresh.some((x) => x.hash === r.hash))].slice(0, 5); }); } catch {}
  }, []);

  useEffect(() => {
    document.body.classList.add("home");
    const off = onAccount(setAcct);
    let alive = true;
    (async () => {
      const [{ createDirector }, { mountStudio }] = await Promise.all([import("./studio/director.js"), import("./studio/studio.js")]);
      if (!alive) return;
      const d = createDirector({
        onState: (s: any) => {
          setStats({ minted: s.swarm.stats.minted, sold: s.swarm.stats.sold, revenue: s.swarm.stats.revenue_total, live: s.swarm.live, jobs: s.swarm.stats.jobs });
          setLatest((cur) => {
            if (cur) { const j = s.jobs.find((x: any) => x.id === cur.jobId); if (j && j.status === "sold" && cur.status !== "sold") return { ...cur, status: "sold", buyer: j.buyer }; return cur; }
            const j = s.jobs.find((x: any) => x.status === "listed" || x.status === "sold");
            return j ? { img: `/api/media/${j.media}`, title: j.title, price: toNear(j.price, 3).replace(/\.?0+$/, ""), status: j.status, buyer: j.buyer, tokenId: j.token_id, jobId: j.id, priceY: j.price } : null;
          });
        },
        onTx: (t: any) => pushTx({ hash: t.hash, signer: t.signerId, method: t.method, ok: t.ok, error: t.error }),
        onStatus: (m: string) => setStatus(m),
        onInfo: () => {},
      });
      dir.current = d;
      d.subscribe((s: any) => setMode({ mode: s.mode, jobId: s.jobId, running: s.running }));
      await d.refresh();
      if (mounted) return; mounted = true;
      studio.current = mountStudio({
        container: stage.current, overlay: overlay.current, director: d,
        hooks: {
          onArtwork: (a: any) => setLatest({ img: a.img, title: a.title, price: a.price, status: "listed", tokenId: a.tokenId, jobId: a.jobId, priceY: d.current?.get("listing")?.priceY }),
          onSale: (s: any) => { setLatest((c) => (c ? { ...c, status: "sold", buyer: s.buyer } : c)); d.refresh(); loadFeed(); },
          onBeat: (b: string, cyc: any) => d.onBeat(b, cyc),
          onReady: () => document.body.classList.add("ready"),
        },
      });
    })();
    loadFeed(); const t = setInterval(loadFeed, 20000);
    // wallet redirect return
    consumeWalletReturn().then((r) => {
      if (!r) return;
      if (r.error) { toast(r.error, 5000); return; }
      r.hashes.forEach((h) => pushTx({ hash: h, signer: "you", method: "buy", ok: r.ok }));
      toast(r.ok ? "Verified on-chain: it's yours, and the split is paid. Welcome, collector!" : "Your wallet tx failed on-chain. You were not charged for the NFT.", 5000);
      setLatest((c) => (c && r.ok && r.events.some((e: any) => e.event === "sold" && String(e.data?.token_id) === String(c.tokenId)) ? { ...c, status: "sold", buyer: "you" } : c));
    });
    return () => { alive = false; off(); clearInterval(t); document.body.classList.remove("home"); };
  }, [loadFeed, pushTx]);

  useEffect(() => { document.body.classList.toggle("focus", focus); studio.current?.studio?.setFocus(focus); }, [focus]);
  useEffect(() => {
    const sync = () => {
      const on = !!nativeFsEl() || document.body.classList.contains("room-fs");
      setFs(on);
      if (on) syncVpVars();
      bumpResize();
    };
    const evs = ["fullscreenchange", "webkitfullscreenchange", "orientationchange"] as const;
    evs.forEach((e) => addEventListener(e, sync));
    visualViewport?.addEventListener("resize", sync);
    return () => { evs.forEach((e) => removeEventListener(e, sync)); visualViewport?.removeEventListener("resize", sync); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        if (nativeFsEl() || document.body.classList.contains("room-fs")) { e.preventDefault(); exitFs(); return; }
        setFocus(false);
        return;
      }
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) { e.preventDefault(); toggleFs(); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [fs]);


  const run = () => { if (!dir.current) return; setStatus("Curator is reading live trends…"); dir.current.run({ autoSell }); };
  const collect = async () => {
    if (!latest?.tokenId || latest.status !== "listed") return;
    if (!acct) { connect(); toast("Connect a NEAR testnet wallet to collect."); return; }
    const priceY = latest.priceY || dir.current?.state?.jobs?.find((j: any) => j.id === latest.jobId)?.price;
    try {
      toast("Confirm the purchase in your wallet…");
      const r = await walletBuy(latest.tokenId, priceY);
      if (r?.hash) {
        pushTx({ hash: r.hash, signer: acct, method: "buy", ok: r.ok });
        const ev = r.events.find((e: any) => e.event === "split_paid");
        dir.current?.walletSold(latest.tokenId, acct, ev, r.hash);
        setLatest((c) => (c ? { ...c, status: "sold", buyer: acct } : c));
        toast(r.ok ? "It's yours! The contract split your payment between the robots and the owner." : "The wallet reported a failure. Check the tx.");
      }
    } catch (e: any) { toast(walletError(e), 4500); }
  };
  const demoBuy = async () => {
    if (!latest?.tokenId) return;
    setStatus("The demo collector is buying it on-chain…");
    const r = await fetch("/api/swarm/collect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: latest.tokenId }) });
    const d = await r.json().catch(() => ({}));
    if (d.tx) { pushTx({ hash: d.tx.hash, signer: d.tx.signerId, method: "buy", ok: d.tx.ok, error: d.tx.error }); const ev = d.tx.events?.find((e: any) => e.event === "split_paid"); dir.current?.walletSold(latest.tokenId, d.tx.signerId, ev, d.tx.hash); setLatest((c) => (c ? { ...c, status: "sold", buyer: d.tx.signerId } : c)); }
    setStatus(d.error || (d.tx?.ok ? "Sold to the demo collector. Split paid on-chain." : "Purchase failed"));
  };

  const m = mode.mode;
  return (
    <>
      <div className="stage" ref={stage}>
        <div className="overlay" ref={overlay}></div>
        <button type="button" className="fs-btn" aria-pressed={fs} aria-label={fs ? "Exit fullscreen" : "Enter fullscreen"} title={fs ? "Exit fullscreen (Esc)" : "Fullscreen (F)"} onClick={toggleFs}>
          {fs ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h5V4M15 4v5h5M3 15h5v5M15 20v-5h5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M21 8V3h-5M8 21H3v-5M21 16v5h-5" /></svg>
          )}
        </button>
      </div>
      <main className="hero-copy">
        <p className="eyebrow">AI swarm art studio on NEAR <i></i></p>
        <h1><span>Muse</span><span className="grad">Swarm</span></h1>
        <p className="lede">Four AI robots, each with its own NEAR account, turn live trends into art, judge it, mint it and sell it. Every sale is split on-chain. Press the button to run a real cycle.</p>
        <div className="run-row">
          <button className="btn" onClick={run} disabled={mode.running}>{mode.running ? "Robots at work…" : "Run a real cycle"} <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          <button className="btn-2" onClick={() => setFocus(true)}>Watch them work</button>
        </div>
        <label className="auto"><input type="checkbox" checked={autoSell} onChange={(e) => setAutoSell(e.target.checked)} /> If no wallet buys within 12 s, the demo collector buys it</label>
        <p className="status">{mode.running && <i />}{status}</p>
        <aside className="latest" id="latest">
          {latest?.img ? <img src={latest.img} alt={latest.title} /> : <img alt="" />}
          <div className="lt-meta">
            <span className="mode" data-m={latest && latest.jobId === mode.jobId ? m : "replay"}>{!latest ? "Loading chain…" : latest.jobId !== mode.jobId ? <>Latest · <a href={`/gallery#job-${latest.jobId}`}>job #{latest.jobId}</a></> : m === "live" ? `Live · job #${mode.jobId}` : m === "watch" ? `Watching job #${mode.jobId}` : <>Replay · <a href={`/gallery#job-${mode.jobId}`}>job #{mode.jobId}</a></>}</span>
            <b>{latest?.title || "…"}</b>
            <span className="lt-price">{latest ? `${latest.price} NEAR` : ""}{latest?.status === "sold" ? ` · sold to ${short(latest.buyer || "", 20)}` : latest ? <> · for sale · <a href={`/gallery#job-${latest.jobId}`}>where + plan</a></> : ""}</span>
          </div>
          <div className="lt-btns">
            <button className="btn-sm" disabled={latest?.status !== "listed"} onClick={collect}>{latest?.status === "sold" ? "Sold" : acct ? "Collect" : "Collect"}</button>
            {latest?.status === "listed" && !mode.running && <button className="btn-sm ghost" onClick={demoBuy} title="Our testnet demo account buys it (max 0.25 NEAR)">Demo buy</button>}
          </div>
        </aside>
      </main>
      <section className="features hero-copy">
        <div><i style={{ ["--c" as any]: "#16A39C" }}><svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg></i><p><b>4 robot accounts</b><span>Limited keys, own budgets</span></p></div>
        <div><i style={{ ["--c" as any]: "#F48AA6" }}><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg></i><p><b>Score gate</b><span>Below 7.0 never mints</span></p></div>
        <div><i style={{ ["--c" as any]: "#F6C53E" }}><svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-9" /></svg></i><p><b>On-chain split</b><span>Every sale, by the contract</span></p></div>
      </section>
      <section className="feed">
        <h4><span>Live on-chain activity</span><a href="/ledger">Full ledger →</a></h4>
        <ul>
          {feed.map((t) => { const w = who(t.signer === "you" ? acct || "you" : t.signer); return (
            <li key={t.hash} className={t.fresh ? "new" : ""}><i className="dot" style={{ background: w.color }} /><b>{w.name}</b><span className={t.ok ? "" : "err"}>{t.ok ? label(t.method) : `failed: ${short(t.error || "", 40)}`}</span><a href={txUrl(t.hash)} target="_blank" rel="noreferrer">tx ↗</a></li>); })}
          {!feed.length && <li><span>Loading transactions from NEAR…</span></li>}
        </ul>
      </section>
      <div className="statbar">
        <div><span>Works minted</span><b>{stats.minted}</b><em>▲</em></div>
        <div><span>Sales</span><b>{toNear(stats.revenue, 3).replace(/\.?0+$/, "") || "0"} NEAR</b><em>▲</em></div>
        <div><span>{stats.live ? "Robots live" : "Swarm paused"}</span><b>{stats.live ? 4 : 0}</b><em className="dots"><i></i><i></i><i></i><i></i></em></div>
      </div>
      <a className="back btn-ghost" href="#" onClick={(e) => { e.preventDefault(); setFocus(false); }}>← Back to home</a>
      <nav className="mlinks"><a href="/how">How it works</a><a href="/gallery">Gallery</a><a href="/robots">Robots</a><a href="/ledger">Ledger</a></nav>
      <p className="foot">NEAR testnet · real transactions with test NEAR · {stats.jobs} jobs so far · <a href="/how">how it works</a></p>
    </>
  );
}
