import { readLimited } from "@/lib/ratelimit";
import { view, viewOn } from "@/lib/near";
import { readPlan } from "@/lib/marketing";
import { CONTRACT_ID, MARKET_ID, MARKET_NAME, EXPLORER } from "@/lib/config";

export const dynamic = "force-dynamic";

interface MbListing { nft_token_id: string; nft_approval_id: number; price: string; currency: string; current_offer: unknown }

/**
 * Where each piece is for sale, and the Seller's marketing plan, read live from chain + IPFS:
 * - token metadata (NEP-177) from our contract; `reference` = the pinned plan JSON
 * - the Mintbase market contract's own listing for the token
 * GET /api/market?tokens=17,18,19
 */
export async function GET(req: Request) {
  const limited = readLimited(req); if (limited) return limited;
  const ids = (new URL(req.url).searchParams.get("tokens") || "").split(",").map((s) => s.trim()).filter((s) => /^\d{1,8}$/.test(s)).slice(0, 30);
  const out = await Promise.all(ids.map(async (id) => {
    const [tok, mb] = await Promise.all([
      view<{ owner_id: string; metadata: { reference?: string | null; description?: string | null; media?: string | null } } | null>("nft_token", { token_id: id }).catch(() => null),
      viewOn<MbListing | null>(MARKET_ID, "get_listing", { nft_contract_id: CONTRACT_ID, token_id: id }).catch(() => null),
    ]);
    const ref = tok?.metadata?.reference || null;
    const doc: any = ref ? await readPlan(ref).catch(() => null) : null;
    const listedHere = tok?.owner_id === CONTRACT_ID;
    return [id, {
      owner: tok?.owner_id ?? null,
      metadata: tok ? { description: tok.metadata?.description ?? null, media: tok.metadata?.media ?? null, reference: ref } : null,
      plan: doc?.marketing ?? null, planCid: ref,
      venues: [
        { venue: "Muse Swarm", kind: "direct", live: listedHere, contract: CONTRACT_ID },
        { venue: MARKET_NAME, kind: "market", market: MARKET_ID, live: !!mb && listedHere, price: mb?.price ?? null, approvalId: mb?.nft_approval_id ?? null,
          url: `${EXPLORER}/address/${MARKET_ID}`, note: "On-chain Mintbase market contract (NEP-178 approval, NEP-199 payout)." },
      ],
    }];
  }));
  return Response.json({ market: MARKET_ID, tokens: Object.fromEntries(out) }, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=30" } });
}
