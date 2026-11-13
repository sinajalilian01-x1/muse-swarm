import { getJobs } from "@/lib/swarm";
import { json } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const before = u.searchParams.get("before") || undefined;
  try {
    return json({ jobs: await getJobs(before && /^\d+$/.test(before) ? before : undefined, Math.min(50, Number(u.searchParams.get("limit") || 24))) });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
