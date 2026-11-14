import { ledger } from "@/lib/ledger";
import { json, intParam, readLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  const u = new URL(req.url);
  const limit = intParam(u.searchParams.get("limit"), 60, 1, 100);
  const offset = intParam(u.searchParams.get("offset"), 0, 0, 100_000);
  try {
    return json(await ledger(limit, offset));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}
