import "server-only";
import { chat, key, TEXT_MODEL } from "./ai";
import { pin, fetchIpfs } from "./ipfs";
import { CONTRACT_ID, NETWORK, nearNum, MARKET_ID, MARKET_NAME, APP_URL } from "./config";
import type { Job } from "./types";

export { MARKET_ID };
export const mintbaseTokenUrl = (tokenId: string) =>
  `https://${NETWORK === "mainnet" ? "" : "testnet."}mintbase.xyz/contract/${CONTRACT_ID}/token/${encodeURIComponent(tokenId)}`;

export interface Plan {
  pitch: string; audience: string; channel: string; best_time: string; hashtags: string[];
  /** Why the Seller and Curator chose this angle. */
  why: string;
  /** Draft posts only. Never posted anywhere by the app. */
  x_drafts: string[];
  model: string; ai: boolean; error?: string;
}

/** The Seller's price decision and its reason, kept in the token's reference JSON (CID on-chain). */
export interface Pricing { price: number; reason: string; model: string; ai: boolean; rule_price: number; rule_reason: string; lesson: string | null; learned_sha256: string | null }

const clean = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const tag = (s: string) => "#" + s.replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");

function sourceKind(source: string) {
  const s = source.toLowerCase();
  if (s.includes("ycombinator")) return "hn";
  if (s.includes("geo=gb") || s.includes(".co.uk") || s.includes("bbc.") || s.includes("guardian")) return "uk";
  return "us";
}

/** The Seller's rule-based marketer (labeled fallback when NEAR AI is not configured). */
function fallbackPlan(job: Job, price: number, url: string): Plan {
  const kind = sourceKind(job.source);
  const score = (job.score / 10).toFixed(1);
  const scene = /skyline|arena|city/i.test(job.title) ? "skyline" : /sea|swell|surf|tide/i.test(job.title) ? "seascape" : /petal|bloom/i.test(job.title) ? "bloom" : /sky|cosmos|night/i.test(job.title) ? "night sky" : "landscape";
  const audience = kind === "hn"
    ? "Builders and HN readers who follow the story, plus NEAR devs who collect on-chain generative art"
    : `People following “${job.trend}” right now${kind === "uk" ? " in the UK" : " in the US"}, plus low-poly and generative-art collectors on NEAR`;
  const best_time = kind === "hn"
    ? "Weekdays 15:00–17:00 UTC (US morning on HN), while the post is on the front page"
    : kind === "uk" ? "Today 18:00–21:00 UK time, while the trend is still climbing (24 h window)" : "Today 19:00–22:00 US Eastern (01:00–04:00 CET), inside the 24 h trend window";
  const channel = kind === "hn" ? "X (dev/NEAR community) + Mintbase listing" : "X (trend replies + #NEARHackathon) + Mintbase listing";
  const hashtags = [tag(job.trend), "#NEAR", "#NFT", "#GenerativeArt", kind === "hn" ? "#BuildOnNEAR" : "#LowPoly"].filter((h, i, a) => h.length > 1 && a.indexOf(h) === i).slice(0, 5);
  const pitch = `A one-of-one low-poly ${scene} painted by an AI robot the hour “${job.trend}” trended, passed by a strict AI critic at ${score}/10. ${price} NEAR, and every sale is split on-chain between the four robots and their owner.`;
  const x_drafts = [
    `“${job.title}” — our Painter robot turned today's “${job.trend}” trend into a low-poly ${scene}. The Critic robot gave it ${score}/10, so the contract minted it. ${price} NEAR, split on-chain. ${url} ${hashtags.slice(0, 3).join(" ")}`,
    `Four AI agents run an art studio on @NEARProtocol: one reads trends, one paints, one judges, one sells. Piece #${job.id}: “${job.title}”. Collect it here or on Mintbase → ${url} #NEARHackathon`,
  ].map((s) => s.slice(0, 280));
  return { pitch: pitch.slice(0, 280), audience, channel, best_time, hashtags,
    why: `Trend source: ${kind === "hn" ? "Hacker News" : `Google Trends ${kind.toUpperCase()}`}. Trend pieces sell best inside the trend's first day, so the plan targets that window and the people already searching for it.`,
    x_drafts, model: "fallback-marketer", ai: false };
}

/** Seller (with the Curator's trend context) writes a marketing plan for one piece. NEAR AI when configured, labeled fallback otherwise. */
export async function marketingPlan(job: Job, price: number): Promise<Plan> {
  const url = `${APP_URL}/gallery#job-${job.id}`;
  let error: string | undefined;
  if (key()) {
    try {
      const { data } = await chat(TEXT_MODEL, [
        { role: "system", content: "You are the Seller robot in Muse Swarm, an AI art studio on NEAR, working with the Curator robot who picked the trend. You write sharp, honest, non-spammy marketing for one NFT. No fake claims, no price hype, no engagement bait. Reply with JSON only." },
        { role: "user", content: `Artwork: "${job.title}" (#${job.id}), low-poly painting. Trend it came from: "${job.trend}" (${job.source}). Brief: ${job.brief.replace(/\s*\[L:[A-Za-z0-9]+\]\s*$/, "")}. Critic score ${(job.score / 10).toFixed(1)}/10. Price ${price} NEAR on NEAR ${NETWORK}; every sale is split on-chain between the four robots and the owner. Link: ${url}.
Return {"pitch": "max 40 words", "audience": "who exactly, max 20 words", "channel": "best channel, max 10 words", "best_time": "when to post and why, max 16 words", "hashtags": ["3-5 hashtags"], "why": "one sentence strategy", "x_drafts": ["two X posts under 260 chars each, include the link"]}` },
      ], 600);
      const plan: Plan = {
        pitch: clean(data.pitch, 280), audience: clean(data.audience, 120), channel: clean(data.channel, 80), best_time: clean(data.best_time, 80),
        hashtags: (Array.isArray(data.hashtags) ? data.hashtags : []).map((h: unknown) => clean(h, 30)).filter(Boolean).map((h: string) => (h.startsWith("#") ? h : "#" + h)).slice(0, 5),
        why: clean(data.why, 200), x_drafts: (Array.isArray(data.x_drafts) ? data.x_drafts : []).map((d: unknown) => clean(d, 280)).filter(Boolean).slice(0, 2),
        model: TEXT_MODEL, ai: true,
      };
      if (plan.pitch && plan.x_drafts.length) return plan;
      throw new Error("NEAR AI plan was incomplete");
    } catch (e) { error = (e as Error).message; }
  }
  return { ...fallbackPlan(job, price, url), error };
}

/** Pin the full plan as the token's NEP-177 reference JSON and return the on-chain plan argument. */
export async function pinPlan(job: Job, plan: Plan, price: number, pricing?: Pricing) {
  const doc = {
    // NEP-177 reference: extra token info, readable by wallets/marketplaces.
    name: job.title, description: plan.pitch, token_id: job.token_id, contract: CONTRACT_ID, external_url: `${APP_URL}/gallery#job-${job.id}`,
    attributes: [{ trait_type: "Trend", value: job.trend }, { trait_type: "Critic score", value: job.score / 10 }, { trait_type: "List price (NEAR)", value: price }],
    marketing: { ...plan, status: "drafts only: Muse Swarm never posts to X or any external account" },
    ...(pricing ? { pricing } : {}),
    for_sale: [{ venue: "Muse Swarm", url: `${APP_URL}/gallery#job-${job.id}` }, { venue: MARKET_NAME, market: MARKET_ID, url: job.token_id ? mintbaseTokenUrl(job.token_id) : null }],
  };
  const pinned = await pin(Buffer.from(JSON.stringify(doc, null, 1)), `muse-swarm-plan-${job.id}.json`, "application/json");
  return { arg: { pitch: plan.pitch, audience: plan.audience, channel: plan.channel, best_time: plan.best_time, hashtags: plan.hashtags, reference: pinned.cid }, cid: pinned.cid };
}

const planCache = new Map<string, unknown>();
export async function readPlan(cid: string) {
  if (planCache.has(cid)) return planCache.get(cid);
  const { bytes } = await fetchIpfs(cid);
  const j = JSON.parse(bytes.toString("utf8"));
  planCache.set(cid, j);
  return j;
}
export const priceNum = (y: string) => nearNum(y);
