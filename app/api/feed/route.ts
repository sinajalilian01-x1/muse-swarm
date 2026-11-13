import { thoughts } from "@/lib/reasoning";
import { json, intParam } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const items = await thoughts(intParam(new URL(req.url).searchParams.get("limit"), 12, 1, 30));
    return Response.json({ items }, { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
