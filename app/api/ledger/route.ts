import { ledger } from "@/lib/ledger";
import { json } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const limit = Math.min(100, Number(u.searchParams.get("limit") || 60));
  const offset = Math.max(0, Number(u.searchParams.get("offset") || 0));
  try {
    return json(await ledger(limit, offset));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
