import { thoughts } from "@/lib/reasoning";
import { current } from "@/lib/bounty";
import { json, intParam, readLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  try {
    const [items, cur] = await Promise.all([thoughts(intParam(new URL(req.url).searchParams.get("limit"), 12, 1, 30)), current().catch(() => null)]);
    const b = cur?.status === "open" ? cur.bounty : null;
    const bounty = b ? { id: b.id, job: b.job, token_id: b.token_id, title: b.title, deadline: b.deadline, entries: cur!.entries, payout: "0.02" } : null;
    return Response.json({ items, bounty }, { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
