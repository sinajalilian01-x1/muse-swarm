"use client";
import { useEffect, useRef } from "react";

/**
 * Night mode backdrop ("Aurora"): true black, faint twinkling stars and soft teal/mint aurora ribbons
 * drifting across the top. Canvas 2D. Runs only in night mode, pauses when the tab is hidden, and draws
 * one still frame under prefers-reduced-motion. The ribbons are drawn into a tiny offscreen canvas and
 * scaled up, so the blur is free (no ctx.filter, which is slow on phones and missing in older Safari).
 */
type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; c: string; glow: boolean };
const BANDS = [
  { y: 0.07, amp: 0.075, thick: 0.12, speed: 0.12, phase: 0.2, waves: 1.7, color: "31,184,154", a: 0.46 },
  { y: 0.14, amp: 0.1, thick: 0.09, speed: 0.08, phase: 1.7, waves: 1.35, color: "126,240,212", a: 0.4 },
  { y: 0.04, amp: 0.05, thick: 0.16, speed: 0.06, phase: 2.4, waves: 1.1, color: "64,210,200", a: 0.3 },
  { y: 0.2, amp: 0.07, thick: 0.07, speed: 0.15, phase: 0.9, waves: 2.15, color: "180,250,220", a: 0.28 },
  { y: 0.11, amp: 0.045, thick: 0.035, speed: 0.1, phase: 3.1, waves: 2.5, color: "230,255,240", a: 0.26 },
];

export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    // black + stars + vignette, re-rendered a few times a second (twinkle) instead of every frame
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d", { alpha: false })!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = matchMedia("(max-width: 900px)").matches;
    const minFrame = small ? 1000 / 30 : 1000 / 60; // phones: 30 fps is plenty for a slow sky
    const baseEvery = small ? 0.3 : 0.1; // seconds between star twinkle updates
    let w = 0, h = 0, raf = 0, start = 0, lastDraw = 0, lastBase = -1, stars: Star[] = [], vignette: CanvasGradient | null = null;

    const size = () => {
      const dpr = Math.min(small ? 1 : 1.5, window.devicePixelRatio || 1); // soft content: low DPR is invisible and much cheaper
      const nw = Math.max(1, window.innerWidth), nh = Math.max(1, window.innerHeight);
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base.width = canvas.width; base.height = canvas.height; bctx.setTransform(dpr, 0, 0, dpr, 0, 0); lastBase = -1;
      off.width = Math.max(120, Math.round(w / 7)); off.height = Math.max(90, Math.round(h / 7));
      const n = Math.round((w * h) / 18000 + 70);
      stars = Array.from({ length: n }, () => {
        const roll = Math.random();
        return { x: Math.random() * w, y: Math.random() * h, r: (0.5 + Math.random() * 1.4) * 0.8, a: 0.35 + Math.random() * 0.65, tw: 0.4 + Math.random() * 1.8, ph: Math.random() * Math.PI * 2,
          c: roll < 0.18 ? "200,255,244" : roll < 0.36 ? "255,244,220" : "255,255,255", glow: Math.random() < 0.1 };
      });
      vignette = bctx.createRadialGradient(w * 0.5, h * 0.55, h * 0.15, w * 0.5, h * 0.55, h * 0.9);
      vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    };
    const waveY = (b: (typeof BANDS)[number], x: number, t: number, ow: number, oh: number) => {
      const nx = x / ow;
      return oh * b.y + Math.sin(nx * Math.PI * 2 * b.waves + t * b.speed * Math.PI * 2 + b.phase) * oh * b.amp + Math.sin(nx * Math.PI * 5.2 + t * b.speed * 1.7 + b.phase * 1.3) * oh * b.amp * 0.28;
    };
    const drawBase = (t: number) => {
      bctx.fillStyle = "#000"; bctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? s.a : s.a * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
        if (s.glow) { bctx.fillStyle = `rgba(${s.c},${a * 0.18})`; bctx.beginPath(); bctx.arc(s.x, s.y, s.r * 4, 0, 6.2832); bctx.fill(); }
        bctx.fillStyle = `rgba(${s.c},${a})`; bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, 6.2832); bctx.fill();
      }
      if (vignette) { bctx.fillStyle = vignette; bctx.fillRect(0, 0, w, h); }
    };
    const draw = (t: number) => {
      size();
      if (lastBase < 0 || t - lastBase >= baseEvery || t < lastBase) { drawBase(t); lastBase = t; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base, 0, 0); ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      const ow = off.width, oh = off.height, steps = small ? 24 : 32;
      octx.clearRect(0, 0, ow, oh);
      octx.globalCompositeOperation = "lighter";
      for (const b of BANDS) {
        octx.beginPath();
        for (let i = 0; i <= steps; i++) { const x = (i / steps) * ow; const y = waveY(b, x, t, ow, oh); if (i) octx.lineTo(x, y); else octx.moveTo(x, y); }
        for (let i = steps; i >= 0; i--) { const x = (i / steps) * ow; octx.lineTo(x, waveY(b, x, t + 0.4, ow, oh) + oh * b.thick); }
        octx.closePath();
        const mid = oh * (b.y + b.thick * 0.45);
        const g = octx.createLinearGradient(0, mid - oh * b.thick, 0, mid + oh * b.thick * 1.1);
        g.addColorStop(0, `rgba(${b.color},0)`); g.addColorStop(0.45, `rgba(${b.color},${b.a})`); g.addColorStop(1, `rgba(${b.color},0)`);
        octx.fillStyle = g; octx.fill();
      }
      octx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = small ? "low" : "high";
      ctx.globalCompositeOperation = "lighter";
      if (small) { ctx.globalAlpha = 0.85; ctx.drawImage(off, 0, 0, w, h * 0.78); ctx.globalAlpha = 1; }
      else { ctx.drawImage(off, 0, 0, w, h * 0.78); ctx.globalAlpha = 0.55; ctx.drawImage(off, -w * 0.01, h * 0.004, w * 1.02, h * 0.78); ctx.globalAlpha = 1; }
      ctx.globalCompositeOperation = "source-over";
    };
    const on = () => document.documentElement.dataset.theme === "dark";
    const frame = (now: number) => {
      raf = 0;
      if (!on() || document.hidden) return;
      if (!start) start = now;
      if (now - lastDraw >= minFrame - 1) { lastDraw = now; draw((now - start) / 1000); }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      if (!on()) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
      if (reduce) { draw(1.6); return; }
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onVis = () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else sync(); };
    const onResize = () => { if (on() && (reduce || !raf)) draw(1.6); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize);
    sync();
    return () => { mo.disconnect(); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="aurora-bg" aria-hidden="true" />;
}
