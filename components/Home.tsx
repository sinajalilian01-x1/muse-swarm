/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { buy as walletBuy, onAccount, connect, consumeWalletReturn, walletError, commission as walletCommission, commissionWnear } from "@/lib/wallet";
import { toast, who, label, txUrl, short } from "@/lib/ui";
import { toNear, txUrl as txLink, NETWORK, NET_NAME } from "@/lib/config";
import { PAY_ASSETS } from "@/lib/intents";

interface Latest { img: string; title: string; price: string | number; status: "listed" | "sold"; buyer?: string; tokenId?: string | null; jobId?: string; priceY?: string }
interface Board { hours: number; days: number; revenue: number; outsideRevenue: number; testRevenue: number; realBuyers: number; realCommissions: number; jobs: number; sold: number; agentPayments: number; agentPaid: number; treasury: number; delivered: number; marketSales: number; ai?: { nearAi: boolean; provider: string }; links: Record<string, string> }
interface FeedTx { hash: string; signer: string; method?: string; ok: boolean; error?: string; fresh?: boolean }

let mounted = false;

export default function Home() {
  const stage = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
  const dir = useRef<any>(null), studio = useRef<any>(null);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [stats, setStats] = useState({ minted: 0, sold: 0, revenue: "0", live: true, jobs: 0 });
  const [mode, setMode] = useState<{ mode: string; jobId: string | null; running: boolean }>({ mode: "idle", jobId: null, running: false });
  const [status, setStatus] = useState("");
  const [autoSell, setAutoSell] = useState(NETWORK !== "mainnet");
  const [feed, setFeed] = useState<FeedTx[]>([]);
  const [acct, setAcct] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [fs, setFs] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [cOpen, setCOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cDone, setCDone] = useState<{ hash?: string; text: string; ok: boolean } | null>(null);
  const [anyTok, setAnyTok] = useState<{ asset: string; q?: any; err?: string; loading?: boolean; swap?: string } | null>(null);
  const [floorY, setFloorY] = useState("50000000000000000000000");
  const floor = Number(toNear(floorY, 3));
  const cPrice = (Math.max(0.06, floor + 0.01)).toFixed(2);

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
          if (s.swarm.rules?.floor) setFloorY(s.swarm.rules.floor);
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
    const lb = async () => { try { const d = await (await fetch("/api/scoreboard", { cache: "no-store" })).json(); if (!d.error) setBoard(d); } catch {} };
    lb(); const tb = setInterval(lb, 15000);
    // wallet redirect return
    consumeWalletReturn().then((r) => {
      if (!r) return;
      if (r.error) { toast(r.error, 5000); return; }
      r.hashes.forEach((h) => pushTx({ hash: h, signer: "you", method: "buy", ok: r.ok }));
      toast(r.ok ? "Verified on-chain: it's yours, and the split is paid. Welcome, collector!" : "Your wallet tx failed on-chain. You were not charged for the NFT.", 5000);
      setLatest((c) => (c && r.ok && r.events.some((e: any) => e.event === "sold" && String(e.data?.token_id) === String(c.tokenId)) ? { ...c, status: "sold", buyer: "you" } : c));
    });
    return () => { alive = false; off(); clearInterval(t); clearInterval(tb); document.body.classList.remove("home"); };
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


  /** Commission: the patron pays first (NEAR, or wNEAR = the NEAR Intents delivery path), then the robots hire each other live. */
  const commissionPiece = async (how: "near" | "wnear") => {
    if (!acct) { connect(); toast(`Connect a ${NET_NAME} wallet to commission a piece.`); return; }
    const b = brief.trim(); if (b.length < 3) { toast("Tell the robots what to paint."); return; }
    setCBusy(true); setCDone(null);
    try {
      toast("Confirm the payment in your wallet…");
      const r = how === "near" ? await walletCommission(b, cPrice) : await commissionWnear(b, cPrice);
      if (!r?.hash || !r.ok) { setCDone({ ok: false, hash: r?.hash, text: "The payment did not go through. Nothing was charged." }); return; }
      pushTx({ hash: r.hash, signer: acct, method: how === "near" ? "commission" : "commission_wnear", ok: true });
      await afterPaid(r.commissionId);
    } catch (e: any) { toast(walletError(e), 4500); } finally { setCBusy(false); }
  };
  /** Once a commission is paid (wallet, wNEAR or NEAR Intents), drive the robots until it is delivered. */
  const afterPaid = async (commissionId?: string | null) => {
      setCOpen(false);
      setStatus(`Paid on-chain (commission #${commissionId}). The Curator is briefing the Painter…`);
      // Commissions are served first-in, first-out: keep cycling until *this* one is delivered (rejections retry).
      let res: any = null, c: any = null;
      const status = async () => (commissionId ? (await (await fetch(`/api/commission?id=${commissionId}`, { cache: "no-store" })).json().catch(() => ({}))).commission : null);
      for (let i = 0; i < 5; i++) {
        res = await dir.current.run({ autoSell: false, commission: true });
        c = await status();
        if (!c || c.status !== "open") break;
        if (res?.failed) await new Promise((ok) => setTimeout(ok, 8000));
        setStatus(res?.rejected ? "The Critic rejected that one. The Painter is trying again for you…" : res?.delivered ? "Delivered the commission queued before yours. Now yours…" : "Still working on your piece…");
      }
      if (c?.status === "delivered") setCDone({ ok: true, hash: res?.sale?.hash, text: `Delivered! NFT #${c.token_id} is in your wallet. The robots hired each other on-chain and the contract split your ${toNear(c.amount, 3)} NEAR.` });
      else setCDone({ ok: false, text: c?.status === "open" ? "Still working on it. Your commission stays open; the robots retry, and you can cancel for a full refund after 30 minutes." : "Something went wrong. Check the ledger." });
  };
  /** NEAR Intents (mainnet): get a real 1Click deposit address, then watch the swap; when it lands, the contract opened the commission. */
  const payAnyToken = async () => {
    if (!acct) { connect(); toast(`Connect a ${NET_NAME} wallet: the NFT is delivered to it.`); return; }
    const b = brief.trim(); if (b.length < 3) { toast("Tell the robots what to paint."); return; }
    if (!anyTok) return;
    setAnyTok({ ...anyTok, loading: true });
    try {
      const d = await (await fetch("/api/intents/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset: anyTok.asset, amountNear: Number(cPrice), brief: b, patron: acct, deposit: true }) })).json();
      if (d.error || !d.depositAddress) { setAnyTok({ ...anyTok, loading: false, err: d.error || "No deposit address" }); return; }
      const since = Date.now() - 60_000;
      setAnyTok({ asset: anyTok.asset, q: d, swap: "Waiting for your deposit…" });
      for (let i = 0; i < 240; i++) { // up to ~20 min
        await new Promise((ok) => setTimeout(ok, 5000));
        const st = await (await fetch(`/api/intents/quote?depositAddress=${encodeURIComponent(d.depositAddress)}`, { cache: "no-store" })).json().catch(() => ({}));
        const s = String(st.status || "");
        setAnyTok((t) => (t ? { ...t, swap: s ? `Swap status: ${s.replace(/_/g, " ").toLowerCase()}` : t.swap } : t));
        if (/REFUNDED|FAILED/.test(s)) { setAnyTok((t) => (t ? { ...t, swap: "The swap failed and was refunded to your NEAR Intents balance." } : t)); return; }
        if (s === "SUCCESS") {
          const c = (await (await fetch(`/api/commission?patron=${encodeURIComponent(acct)}&after=${since}`, { cache: "no-store" })).json().catch(() => ({}))).commission;
          setCBusy(true);
          try { await afterPaid(c?.id); } finally { setCBusy(false); }
          return;
        }
      }
    } catch (e: any) { setAnyTok((t) => (t ? { ...t, loading: false, err: String(e?.message || e) } : t)); }
  };
  const quoteAny = async (asset: string) => {
    setAnyTok({ asset, loading: true });
    try {
      const d = await (await fetch("/api/intents/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset, amountNear: Number(cPrice), brief, patron: acct || "" }) })).json();
      setAnyTok({ asset, q: d.error ? undefined : d, err: d.error });
    } catch (e: any) { setAnyTok({ asset, err: String(e?.message || e) }); }
  };
  const run = () => { if (!dir.current) return; setStatus("Curator is reading live trends…"); dir.current.run({ autoSell }); };
  const collect = async () => {
    if (!latest?.tokenId || latest.status !== "listed") return;
    if (!acct) { connect(); toast(`Connect a ${NET_NAME} wallet to collect.`); return; }
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
        <div className="board" aria-live="polite">
          <p className="eyebrow">{board ? <>No humans · ran itself for {board.days >= 1 ? `${board.days} days` : `${board.hours} h`} · {board.jobs} jobs · {board.agentPayments} agent payments</> : "AI swarm art studio on NEAR"} <i></i></p>
          <div className="chips">
            <a href="/robots" title="Sales to real outside wallets. Our own test buys are excluded."><b>{board ? board.outsideRevenue : "…"}</b> NEAR from real buyers ({board ? board.realBuyers : "…"})</a>
            <a href={board?.links.contract || "/ledger"} target="_blank" rel="noreferrer" title="Buys by our own test wallets, shown separately"><b>{board ? board.testRevenue.toFixed(2) : "…"}</b> NEAR test buys ↗</a>
            <a href="/robots" title="Robots paying robots for briefs and appraisals"><b>{board ? board.agentPayments : "…"}</b> agent→agent payments</a>
            <a href={board?.links.treasury || "/robots"} target="_blank" rel="noreferrer" title="AI fees the robots paid into the treasury"><b>{board ? board.treasury.toFixed(2) : "…"}</b> NEAR treasury ↗</a>
            <a href="/how#real" title={board?.ai?.nearAi ? "Curator brief, Painter image, Critic review and Seller pricing + marketing run on NEAR AI Cloud. A labeled fallback takes over only if a call fails." : "No NEAR AI key: labeled local fallback brains"}>{board ? (board.ai?.nearAi ? <><b>NEAR AI Cloud</b> brains</> : <>AI: <b>fallback</b></>) : "…"}</a>
            <a href="/gallery" title="Sold on Mintbase's market or commissioned by visitors"><b>{board ? board.delivered + board.marketSales : "…"}</b> commissions + market sales</a>
          </div>
        </div>
        <h1><span>Muse</span><span className="grad">Swarm</span></h1>
        <p className="lede">An art studio run by four AI agents with their own NEAR accounts. They spot trends, paint, judge, sell and pay each other. Commission a piece and watch them make it for you.</p>
        <div className="run-row">
          <button className="btn" onClick={() => { setCOpen((o) => !o); setCDone(null); }} disabled={mode.running || cBusy}>{cBusy ? "Robots at work…" : `Commission a piece · ${cPrice} NEAR`} <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          <button className="btn-2" onClick={run} disabled={mode.running}>{mode.running && !cBusy ? "Running…" : "Free demo cycle"}</button>
        </div>
        {cOpen && <div className="commission">
          <input value={brief} maxLength={100} placeholder="What should they paint? e.g. a lighthouse made of crystals" onChange={(e) => setBrief(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commissionPiece("near")} autoFocus />
          <div className="c-row">
            <button className="btn-sm" disabled={cBusy} onClick={() => commissionPiece("near")}>{acct ? `Pay ${cPrice} NEAR` : "Connect wallet"}</button>
            <button className="btn-sm ghost" disabled={cBusy} onClick={() => commissionPiece("wnear")} title="ft_transfer_call from wNEAR: the same path a NEAR Intents swap from any token uses">Pay in wNEAR</button>
            <button className="btn-sm ghost" onClick={() => (anyTok ? setAnyTok(null) : quoteAny(PAY_ASSETS[0].id))}>Any token ▾</button>
          </div>
          {anyTok && <div className="anytok">
            <select value={anyTok.asset} onChange={(e) => quoteAny(e.target.value)}>{PAY_ASSETS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
            {anyTok.loading ? <span>Getting a live NEAR Intents quote…</span> : anyTok.err ? <span>Quote failed: {short(anyTok.err, 60)}</span> : anyTok.q && <span><b>{Number(anyTok.q.amountIn).toPrecision(4)} {anyTok.q.asset.split(" ")[0]}</b> ≈ ${Number(anyTok.q.amountInUsd).toFixed(2)} → {anyTok.q.amountOut} wNEAR, ~{anyTok.q.timeEstimate}s via NEAR Intents 1Click.{NETWORK !== "mainnet" && " Mainnet only: live dry-run price, nothing to send on testnet."}</span>}
            {NETWORK === "mainnet" && anyTok.q && !anyTok.q.depositAddress && !anyTok.loading && <button className="btn-sm" onClick={payAnyToken}>{acct ? `Pay with ${anyTok.q.asset}` : "Connect wallet to pay"}</button>}
            {anyTok.q?.depositAddress && <span className="dep">Send exactly <b>{anyTok.q.amountIn} {anyTok.q.asset.split(" ")[0]}</b> ({anyTok.q.asset}) to <code style={{ wordBreak: "break-all" }}>{anyTok.q.depositAddress}</code> <button className="btn-sm ghost" onClick={() => navigator.clipboard?.writeText(anyTok.q.depositAddress).then(() => toast("Deposit address copied"))}>Copy</button><br />Your NFT goes to {short(acct || "", 24)}. Refunds go to your NEAR Intents balance. {anyTok.swap}</span>}
          </div>}
          <p className="c-note">You pay first; the contract holds it. The robots brief, paint, judge and mint it, then the Seller delivers the NFT to you and the payment is split on-chain. Not delivered in 30 min? Cancel for a full refund.</p>
        </div>}
        {cDone && <p className={`c-done ${cDone.ok ? "ok" : ""}`}>{cDone.text} {cDone.hash && <a href={txLink(cDone.hash)} target="_blank" rel="noreferrer">tx ↗</a>} <a href="/gallery">gallery →</a></p>}
        {!cOpen && !cDone && NETWORK !== "mainnet" && <label className="auto"><input type="checkbox" checked={autoSell} onChange={(e) => setAutoSell(e.target.checked)} /> Free cycle: if no wallet buys within 12 s, the demo collector buys it · <a href="#" onClick={(e) => { e.preventDefault(); setFocus(true); }}>watch them work</a></label>}
        <p className="status">{mode.running && <i />}{status}</p>
        <aside className="latest" id="latest" style={cOpen ? { display: "none" } : undefined}>
          {latest?.img ? <img src={latest.img} alt={latest.title} /> : <img alt="" />}
          <div className="lt-meta">
            <span className="mode" data-m={latest && latest.jobId === mode.jobId ? m : "replay"}>{!latest ? "Loading chain…" : latest.jobId !== mode.jobId ? <>Latest · <a href={`/gallery#job-${latest.jobId}`}>job #{latest.jobId}</a></> : m === "live" ? `Live · job #${mode.jobId}` : m === "watch" ? `Watching job #${mode.jobId}` : <>Replay · <a href={`/gallery#job-${mode.jobId}`}>job #{mode.jobId}</a></>}</span>
            <b>{latest?.title || "…"}</b>
            <span className="lt-price">{latest ? `${latest.price} NEAR` : ""}{latest?.status === "sold" ? ` · sold to ${latest.buyer === "you" ? "you" : short(who(latest.buyer || "").name, 24)}` : latest ? <> · for sale · <a href={`/gallery#job-${latest.jobId}`}>where + plan</a></> : ""}</span>
          </div>
          <div className="lt-btns">
            <button className="btn-sm" disabled={latest?.status !== "listed"} onClick={collect}>{latest?.status === "sold" ? "Sold" : acct ? "Collect" : "Collect"}</button>
            {latest?.status === "listed" && !mode.running && NETWORK !== "mainnet" && <button className="btn-sm ghost" onClick={demoBuy} title="Our testnet demo account buys it (max 0.25 NEAR)">Demo buy</button>}
          </div>
        </aside>
      </main>
      <section className="features hero-copy" style={cOpen ? { display: "none" } : undefined}>
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
      <p className="foot">{NETWORK === "mainnet" ? "Live on NEAR Mainnet · real NEAR" : "NEAR testnet · real transactions with test NEAR"} · {stats.jobs} jobs so far · <a href="/how">how it works</a></p>
    </>
  );
}
