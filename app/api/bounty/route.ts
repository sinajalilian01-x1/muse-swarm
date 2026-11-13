import { after } from "next/server";
import { bounties, purse, submit, tick, CAPTION_MAX, CAPTION_MIN } from "@/lib/bounty";
import { json, rateLimit, clientIp } from "@/lib/ratelimit";
import { BOUNTY_PAYOUT, toNear } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|node-fetch|undici|playwright|puppeteer/i;

/** The open bounty, past results, and the purse that pays them. Judging happens lazily once the deadline passes. */
export async function GET() {
  try {
    const [list, p] = await Promise.all([bounties(), purse()]);
    if (list.some((b) => b.status === "judging" || b.status === "paying")) after(() => tick().catch(() => {}));
    return Response.json({ bounties: list, purse: p, payout: toNear(BOUNTY_PAYOUT, 2), rules: { captionMin: CAPTION_MIN, captionMax: CAPTION_MAX }, now: Date.now() },
      { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return json({ error: "Automated clients cannot enter." }, 403);
  const rl = rateLimit(req, "bounty", 3, 10 * 60_000);
  if (!rl.ok) return json({ error: `Too many entries from here. Try again in ${rl.retryAfter} s.` }, 429);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  try {
    const r = await submit(body?.account, body?.caption, clientIp(req));
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 200) }, 400);
  }
}
