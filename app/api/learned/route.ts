import { learn } from "@/lib/learn";
import { json } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** What the swarm learned from its own market (visitor signals + chain sales/markdowns), and the per-token stats behind it. */
export async function GET() {
  try {
    return Response.json(await learn(), { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=60" } });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
