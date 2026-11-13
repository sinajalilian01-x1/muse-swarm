import { view } from "@/lib/near";
import { json } from "@/lib/ratelimit";
import type { Commission } from "@/lib/swarm";

export const dynamic = "force-dynamic";

/** GET /api/commission?id=3 : status of one commission (open, delivered, refunded) and its job/token. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{1,9}$/.test(id)) return json({ error: "id required" }, 400);
  try { return json({ commission: await view<Commission | null>("get_commission", { commission_id: id }) }); }
  catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
}
