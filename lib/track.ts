"use client";
/** Market signals for the Seller (see lib/signals.ts): batched, one beacon at a time, views once per session per work. */
type Kind = "view" | "click" | "collect";
const q: { job: string; kind: Kind }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const sent = new Set<string>();
function send() {
  timer = null;
  if (!q.length) return;
  const body = JSON.stringify({ events: q.splice(0, 40) });
  try {
    if (!navigator.sendBeacon?.("/api/signal", new Blob([body], { type: "application/json" }))) fetch("/api/signal", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {}
}
export function track(job: string | null | undefined, kind: Kind) {
  if (!job || typeof window === "undefined") return;
  const k = `${job}:${kind}`;
  if (kind === "view") {
    try { if (sessionStorage.getItem(`ms-sig:${k}`)) return; sessionStorage.setItem(`ms-sig:${k}`, "1"); } catch { if (sent.has(k)) return; }
    sent.add(k);
  }
  q.push({ job, kind });
  if (!timer) timer = setTimeout(send, 1500);
}
if (typeof window !== "undefined") addEventListener("pagehide", send);
