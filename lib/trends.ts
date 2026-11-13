import "server-only";

export interface Trend { name: string; source: string; url: string; context: string; traffic?: string }

const BLOCK = /\b(dead|death|dies|died|killed|kill|shooting|shot|murder|war|attack|crash|victim|funeral|obituar|suicide|abuse|assault|arrest|trial|election|trump|biden|harris|vance|israel|gaza|ukraine|russia|hamas|isis|terror|porn|nude|sex|drug|overdose|gun|bomb|hostage|rape|lawsuit|scandal)\b/i;
const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

async function googleTrends(geo: string): Promise<Trend[]> {
  const r = await fetch(`https://trends.google.com/trending/rss?geo=${geo}`, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "MuseSwarm/1.0 (+https://muse-swarm.vercel.app)" }, cache: "no-store" });
  if (!r.ok) throw new Error(`trends ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const it = m[1];
    const name = decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const news = [...it.matchAll(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/g)].map((x) => decode(x[1])).slice(0, 2);
    const url = decode(it.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] || `https://trends.google.com/trending?geo=${geo}`);
    const traffic = decode(it.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || "");
    return { name, source: `Google Trends ${geo}`, url, context: news.join(" / "), traffic };
  }).filter((t) => t.name);
}

async function hackerNews(): Promise<Trend[]> {
  const ids: number[] = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(5000), cache: "no-store" })).json();
  const items = await Promise.all(ids.slice(0, 12).map(async (id) => {
    try { return await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) })).json(); } catch { return null; }
  }));
  return items.filter(Boolean).map((it: any) => ({ name: String(it.title).slice(0, 70), source: "Hacker News", url: `https://news.ycombinator.com/item?id=${it.id}`, context: `${it.score} points` }));
}

/** Real, current trends from public sources. Unsafe or tragic topics are filtered out. */
export async function fetchTrends(): Promise<Trend[]> {
  const settled = await Promise.allSettled([googleTrends("US"), googleTrends("GB"), hackerNews()]);
  const all = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const seen = new Set<string>();
  return all.filter((t) => {
    const k = t.name.toLowerCase();
    if (seen.has(k) || BLOCK.test(`${t.name} ${t.context}`)) return false;
    seen.add(k);
    return true;
  });
}
