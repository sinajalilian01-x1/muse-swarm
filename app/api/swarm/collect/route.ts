import { collectorCall, view } from "@/lib/near";
import { json, rateLimit } from "@/lib/ratelimit";
import { DEMO_COLLECTOR_MAX } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The demo collector (our own testnet account) buys a listed work, so visitors without a wallet still see a real sale. */
export async function POST(req: Request) {
  const rl = rateLimit(req, "collect", 5, 10 * 60_000);
  if (!rl.ok) return json({ error: `The demo collector is out of breath: try again in ${rl.retryAfter}s.` }, 429);
  const { tokenId } = await req.json().catch(() => ({}));
  if (!/^\d+$/.test(String(tokenId || ""))) return json({ error: "bad token id" }, 400);
  const listings = await view<{ token_id: string; price: string }[]>("get_listings", { from_index: 0, limit: 100 });
  const l = listings.find((x) => x.token_id === String(tokenId));
  if (!l) return json({ error: "Not for sale (already sold?)" }, 404);
  if (BigInt(l.price) > DEMO_COLLECTOR_MAX) return json({ error: "Above the demo collector's 0.25 NEAR limit. Collect it with your own wallet." }, 400);
  try {
    const tx = await collectorCall("buy", { token_id: String(tokenId) }, l.price);
    return json({ tx }, tx.ok ? 200 : 409);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
}
