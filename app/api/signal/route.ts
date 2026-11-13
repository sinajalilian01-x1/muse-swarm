import { after } from "next/server";
import { record, scheduleFlush, visitorHash, KINDS, type SignalKind } from "@/lib/signals";
import { clientIp, rateLimit, json } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|node-fetch|undici|playwright|puppeteer/i;

/** Market signals from real visitors: {events: [{job: "12", kind: "view"|"click"|"collect"}]}. Sent with navigator.sendBeacon. */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return json({ ok: true, counted: 0, ignored: "automated client" });
  if (!rateLimit(req, "signal", 60, 10 * 60_000).ok) return json({ ok: false, counted: 0 }, 429);
  const body = await req.json().catch(() => null);
  const evs: { job: string; kind: SignalKind }[] = (Array.isArray(body?.events) ? body.events : []).slice(0, 40)
    .map((e: any) => ({ job: String(e?.job ?? ""), kind: e?.kind }))
    .filter((e: { job: string; kind: string }) => /^\d{1,7}$/.test(e.job) && KINDS.includes(e.kind as SignalKind));
  const v = visitorHash(clientIp(req));
  let counted = 0;
  for (const e of evs) if (record(v, e.job, e.kind)) counted++;
  if (counted) after(() => scheduleFlush());
  return json({ ok: true, counted });
}
