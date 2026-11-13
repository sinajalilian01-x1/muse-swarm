"use client";
// NEAR Connect (testnet): connect a wallet, buy a listed artwork or back a robot, straight from the swarm contract.
import { CONTRACT_ID, MARKET_ID, NETWORK, RPC_URLS, nearToYocto } from "./config";

type Listener = (account: string | null) => void;
let connector: any = null, account: string | null = null, ready: Promise<any> | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((f) => f(account));

/**
 * NEAR Connect (@hot-labs/near-connect), the connector NEAR now recommends in place of the deprecated
 * Wallet Selector. Wallet code runs in sandboxed iframes from a live manifest. We show only wallets that
 * support testnet + signAndSendTransaction (Meteor, Intear, Nightly, HOT, Ledger, WalletConnect, NEAR CLI…).
 * MyNearWallet is excluded: it entered limited mode in Nov 2026 and no longer approves app transactions.
 */
export function initWallet() {
  if (ready) return ready;
  ready = (async () => {
    const { NearConnector } = await import("@hot-labs/near-connect");
    connector = new NearConnector({
      network: NETWORK,
      features: { signAndSendTransaction: true, [NETWORK]: true } as any,
      excludedWallets: ["mynearwallet"],
      providers: { [NETWORK]: RPC_URLS } as any,
      footerBranding: { heading: "Muse Swarm", link: "https://docs.near.org/tools/near-connect", linkText: "New to NEAR? Get a wallet" } as any,
    });
    connector.on("wallet:signIn", (t: any) => { account = t?.accounts?.[0]?.accountId || account; notify(); });
    connector.on("wallet:signOut", () => { account = null; notify(); });
    try { const c = await connector.getConnectedWallet(); account = c.accounts?.[0]?.accountId || null; notify(); } catch {}
    return connector;
  })();
  return ready;
}
export function onAccount(f: Listener) { listeners.add(f); f(account); return () => { listeners.delete(f); }; }
export function hasSession() { return true; }
export async function connect() {
  const c = await initWallet();
  try { const w = await c.connect(); const accs = await w.getAccounts(); account = accs?.[0]?.accountId || account; notify(); return account; }
  catch { return null; }
}
export async function disconnect() { const c = await initWallet(); try { await c.disconnect(); } catch {} account = null; notify(); }

async function signedInWallet() {
  const c = await initWallet();
  if (!account) { await connect(); if (!account) throw new Error("Connect a wallet first"); }
  return c.wallet();
}
const fnCall = (methodName: string, args: object, gas: bigint, deposit: string | bigint) =>
  ({ type: "FunctionCall", params: { methodName, args, gas: gas.toString(), deposit: String(deposit) } });
function parseResult(res: any) {
  const r = Array.isArray(res) ? res[0] : res;
  const hash = r?.transaction?.hash || r?.transaction_outcome?.id;
  const logs: string[] = (r?.receipts_outcome || []).flatMap((x: any) => x?.outcome?.logs || []);
  const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => { try { return JSON.parse(l.slice(11)); } catch { return null; } }).filter(Boolean)
    .flatMap((e: any) => (e.data || []).map((d: any) => ({ standard: e.standard, event: e.event, data: d })));
  const failed = (r?.status && typeof r.status === "object" && "Failure" in r.status) || (r?.receipts_outcome || []).some((x: any) => "Failure" in (x?.outcome?.status || {}));
  return { hash, events, ok: !!hash && !failed };
}

/** Turn wallet errors into something a visitor understands. */
export function walletError(e: unknown): string {
  const m = String((e as any)?.message || e || "");
  if (/reject|cancel|denied|closed|User (didn't|did not)/i.test(m)) return "You cancelled in your wallet. Nothing was charged.";
  if (/NotEnoughBalance|insufficient|not enough/i.test(m)) return NETWORK === "mainnet" ? "Not enough NEAR in your wallet for this payment plus gas." : "Not enough testnet NEAR in your wallet. Top up from the testnet faucet and try again.";
  if (/Not for sale|not listed|Token not/i.test(m)) return "Someone just collected this work. Pick another listed one.";
  if (/Attached deposit|price/i.test(m)) return "The price changed. Refresh and try again.";
  return m.slice(0, 160) || "Wallet error";
}

/** Read a tx's final status straight from RPC (used after redirect wallets send the visitor back). */
export async function txStatus(hash: string, signer: string): Promise<{ ok: boolean; events: any[]; method?: string } | null> {
  for (const url of RPC_URLS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx", params: { tx_hash: hash, sender_account_id: signer, wait_until: "EXECUTED_OPTIMISTIC" } }) });
      const j = await r.json();
      if (!j.result) continue;
      const res = j.result;
      const failed = "Failure" in (res.status || {}) || (res.receipts_outcome || []).some((x: any) => "Failure" in (x?.outcome?.status || {}));
      const logs: string[] = (res.receipts_outcome || []).flatMap((x: any) => x?.outcome?.logs || []);
      const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => { try { return JSON.parse(l.slice(11)); } catch { return null; } }).filter(Boolean)
        .flatMap((e: any) => (e.data || []).map((d: any) => ({ standard: e.standard, event: e.event, data: d })));
      return { ok: !failed, events, method: res.transaction?.actions?.[0]?.FunctionCall?.method_name };
    } catch {}
  }
  return null;
}

/**
 * Redirect-style wallets send the visitor back with ?transactionHashes=… or ?errorCode=….
 * Call once on page load: it cleans the URL and returns what happened, verified on-chain.
 */
export async function consumeWalletReturn(): Promise<{ hashes: string[]; ok: boolean; events: any[]; error?: string } | null> {
  if (typeof location === "undefined") return null;
  const u = new URL(location.href);
  const hashes = (u.searchParams.get("transactionHashes") || "").split(",").filter(Boolean);
  const errorCode = u.searchParams.get("errorCode");
  if (!hashes.length && !errorCode) return null;
  ["transactionHashes", "errorCode", "errorMessage"].forEach((k) => u.searchParams.delete(k));
  history.replaceState({}, "", u.toString());
  if (errorCode) return { hashes: [], ok: false, events: [], error: /reject|cancel/i.test(errorCode) ? "You cancelled in your wallet. Nothing was charged." : `Wallet error: ${errorCode}` };
  await initWallet().catch(() => null);
  const signer = account || "";
  let ok = true; const events: any[] = [];
  for (const h of hashes) { const st = signer ? await txStatus(h, signer) : null; if (st) { ok = ok && st.ok; events.push(...st.events); } }
  return { hashes, ok, events };
}

/** Anyone can back a robot: attach NEAR to the contract's payable `fund(role)`; it lands in that robot's on-chain budget. */
export async function fund(role: string, amountNear: string) {
  const w = await signedInWallet();
  const res = await w.signAndSendTransaction({ signerId: account, receiverId: CONTRACT_ID, actions: [fnCall("fund", { role }, 30_000_000_000_000n, nearToYocto(amountNear))] });
  const r = parseResult(res);
  return { hash: r.hash, ok: r.ok };
}

/** Buy a listed token from the swarm contract. The contract transfers the NFT and pays the split in the same tx. */
export async function buy(tokenId: string, priceYocto: string) {
  const w = await signedInWallet();
  const res = await w.signAndSendTransaction({ signerId: account, receiverId: CONTRACT_ID, actions: [fnCall("buy", { token_id: tokenId }, 100_000_000_000_000n, priceYocto)] });
  return { ...parseResult(res), account };
}

/** Buy through Mintbase's market contract (the Seller cross-listed it there). The market calls our nft_transfer_payout (NEP-199), so the same split is paid on-chain. */
export async function buyOnMarket(tokenId: string, priceYocto: string) {
  const w = await signedInWallet();
  const res = await w.signAndSendTransaction({ signerId: account, receiverId: MARKET_ID, actions: [fnCall("buy", { nft_contract_id: CONTRACT_ID, token_id: tokenId }, 200_000_000_000_000n, priceYocto)] });
  return { ...parseResult(res), account };
}

/** Commission a piece with NEAR: the deposit is held by the contract until the Seller delivers the NFT. */
export async function commission(brief: string, amountNear: string) {
  const w = await signedInWallet();
  const res = await w.signAndSendTransaction({ signerId: account, receiverId: CONTRACT_ID, actions: [fnCall("commission", { brief }, 30_000_000_000_000n, nearToYocto(amountNear))] });
  const r = parseResult(res);
  const ev = r.events.find((e: any) => e.event === "commissioned");
  return { ...r, commissionId: ev?.data?.commission_id as string | undefined, account };
}

/** Same commission, paid in wNEAR through ft_transfer_call: the exact on-chain path a NEAR Intents 1Click swap
 * (any token, any chain) uses to deliver to the swarm. One wallet tx: register on wNEAR, wrap NEAR, transfer-call. */
export async function commissionWnear(brief: string, amountNear: string) {
  const w = await signedInWallet();
  const wnear = NETWORK === "mainnet" ? "wrap.near" : "wrap.testnet";
  const amt = nearToYocto(amountNear);
  const res = await w.signAndSendTransaction({ signerId: account, receiverId: wnear, actions: [
    fnCall("storage_deposit", { account_id: account, registration_only: true }, 20_000_000_000_000n, nearToYocto("0.00125")),
    fnCall("near_deposit", {}, 20_000_000_000_000n, amt),
    fnCall("ft_transfer_call", { receiver_id: CONTRACT_ID, amount: amt, msg: JSON.stringify({ brief, patron: account }) }, 100_000_000_000_000n, "1"),
  ] });
  const r = parseResult(res);
  const ev = r.events.find((e: any) => e.event === "commissioned");
  return { ...r, commissionId: ev?.data?.commission_id as string | undefined, account };
}
