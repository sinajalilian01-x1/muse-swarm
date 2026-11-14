import { getProof } from "@/lib/proof";
import { readLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Machine-readable mainnet proof (same data as /proof). */
export async function GET(req: Request) {
  const limited = readLimited(req, 60); if (limited) return limited;
  const p = await getProof();
  return Response.json(p, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
