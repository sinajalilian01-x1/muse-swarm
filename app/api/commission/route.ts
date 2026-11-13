import { view } from "@/lib/near";
import { json } from "@/lib/ratelimit";
import type { Commission } from "@/lib/swarm";

export const dynamic = "force-dynamic";

/** GET /api/commission?id=3 : status of one commission (open, delivered, refunded) and its job/token. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "", patron = u.searchParams.get("patron") || "", after = Number(u.searchParams.get("after") || 0);
  if (patron) { // newest commission of a patron opened after a time (used after a NEAR Intents payment)
    const list = await view<Commission[]>("get_commissions", { from_index: null, limit: 20 }).catch(() => [] as Commission[]);
    return json({ commission: list.find((c) => c.patron === patron && Number(c.opened_at_ms) >= after) || null });
  }
  if (!/^\d{1,9}$/.test(id)) return json({ error: "id required" }, 400);
  try { return json({ commission: await view<Commission | null>("get_commission", { commission_id: id }) }); }
  catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
}
