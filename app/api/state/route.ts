import { getSwarm, getJobs, aiMode } from "@/lib/swarm";
import { view } from "@/lib/near";
import { json, readLimited } from "@/lib/ratelimit";
import { CONTRACT_ID, COLLECTOR_ID, NETWORK, OWNER_ID, ROBOT_IDS, TREASURY_ID, GUARDIAN_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  try {
    const [swarm, jobs, listings] = await Promise.all([getSwarm(), getJobs(undefined, 12), view<any[]>("get_listings", { from_index: 0, limit: 50 })]);
    return json({ network: NETWORK, contractId: CONTRACT_ID, robots: ROBOT_IDS, ownerId: OWNER_ID, treasuryId: TREASURY_ID, guardianId: GUARDIAN_ID,
      collectorId: COLLECTOR_ID, swarm, jobs, listings, ai: aiMode(), serverTime: Date.now() });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
