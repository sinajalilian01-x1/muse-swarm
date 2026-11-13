import { json, rateLimit } from "@/lib/ratelimit";
import { ONECLICK, PAY_ASSETS, WNEAR_ASSET } from "@/lib/intents";
import { CONTRACT_ID, NETWORK, nearToYocto } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * POST { asset, amountNear, brief, patron, refundTo }
 * mainnet: a real 1Click quote whose deposit address pays the swarm contract (ft_transfer_call → ft_on_transfer → commission).
 * testnet: a live 1Click dry-run price for the same swap (no deposit address, nothing can be sent), clearly labeled.
 * GET ?depositAddress=… : 1Click swap status (mainnet).
 */
export async function POST(req: Request) {
  if (!rateLimit(req, "intents", 20, 10 * 60_000).ok) return json({ error: "Too many quotes, slow down." }, 429);
  const b = await req.json().catch(() => ({}));
  const asset = PAY_ASSETS.find((a) => a.id === b?.asset);
  const amountNear = Number(b?.amountNear);
  if (!asset || !(amountNear > 0 && amountNear <= 5)) return json({ error: "Pick a token and an amount up to 5 NEAR" }, 400);
  const brief = String(b?.brief || "").slice(0, 120);
  const patron = String(b?.patron || "").slice(0, 64);
  const live = NETWORK === "mainnet";
  if (live && (!brief.trim() || !patron || !b?.refundTo)) return json({ error: "brief, patron and refundTo are required" }, 400);
  const body = {
    dry: !live, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: asset.id, depositType: "ORIGIN_CHAIN",
    destinationAsset: WNEAR_ASSET, amount: nearToYocto(amountNear),
    refundTo: live ? String(b.refundTo) : "0x1111111111111111111111111111111111111111", refundType: "ORIGIN_CHAIN",
    // testnet preview can't name the testnet contract (1Click is mainnet only), so it prices the swap to a known mainnet account.
    recipient: live ? CONTRACT_ID : "intents.near", recipientType: "DESTINATION_CHAIN",
    ...(live ? { customRecipientMsg: JSON.stringify({ brief, patron }) } : {}),
    deadline: new Date(Date.now() + 60 * 60_000).toISOString(), referral: "muse-swarm",
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  try {
    const r = await fetch(`${ONECLICK}/v0/quote`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
    const d = await r.json();
    if (!r.ok || !d.quote) return json({ error: d.message || `1Click ${r.status}` }, 502);
    return json({ live, network: NETWORK, asset: asset.label, amountIn: d.quote.amountInFormatted, amountInUsd: d.quote.amountInUsd, amountOut: d.quote.amountOutFormatted,
      timeEstimate: d.quote.timeEstimate, depositAddress: live ? d.quote.depositAddress : null, deadline: d.quote.deadline ?? body.deadline,
      route: `${asset.label} → wNEAR → ${live ? CONTRACT_ID : "(mainnet swarm contract)"}.ft_on_transfer → commission`,
      note: live ? "Send exactly this amount to the deposit address. 1Click swaps it and the contract opens your commission." : "Testnet preview: a live 1Click mainnet price (dry run). Nothing can be sent. On testnet, pay in NEAR or wNEAR instead." });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
}

export async function GET(req: Request) {
  const addr = new URL(req.url).searchParams.get("depositAddress") || "";
  if (!/^[A-Za-z0-9:._-]{10,120}$/.test(addr)) return json({ error: "depositAddress required" }, 400);
  try {
    const r = await fetch(`${ONECLICK}/v0/status?depositAddress=${encodeURIComponent(addr)}`, { signal: AbortSignal.timeout(8000) });
    return json(await r.json(), r.ok ? 200 : 502);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 502); }
}
