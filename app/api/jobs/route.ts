import { getJobs } from "@/lib/swarm";
import { json, intParam, readLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  const u = new URL(req.url);
  const before = u.searchParams.get("before") || undefined;
  try {
    return json({ jobs: await getJobs(before && /^\d+$/.test(before) ? before : undefined, intParam(u.searchParams.get("limit"), 24, 1, 50)) });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
