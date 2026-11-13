"use client";
// NEAR Wallet Selector (testnet): connect a wallet and buy a listed artwork directly from the swarm contract.
import { CONTRACT_ID, NETWORK, RPC_URLS, nearToYocto } from "./config";

type Listener = (account: string | null) => void;
let selector: any = null, modal: any = null, account: string | null = null;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((f) => f(account));

export async function initWallet() {
  if (selector) return selector;
  const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }, { setupHereWallet }] = await Promise.all([
    import("@near-wallet-selector/core"), import("@near-wallet-selector/modal-ui"), import("@near-wallet-selector/my-near-wallet"),
    import("@near-wallet-selector/meteor-wallet"), import("@near-wallet-selector/here-wallet"),
  ]);
  selector = await setupWalletSelector({ network: NETWORK, modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet()] as any });
  modal = setupModal(selector, { contractId: CONTRACT_ID, description: "Connect a NEAR testnet wallet to collect the swarm's art." } as any);
  const sync = () => { const accs = selector.store.getState().accounts; account = accs.find((a: any) => a.active)?.accountId || accs[0]?.accountId || null; notify(); };
  selector.store.observable.subscribe(sync); sync();
  return selector;
}
export function onAccount(f: Listener) { listeners.add(f); f(account); return () => { listeners.delete(f); }; }
export function hasSession() { try { return Object.keys(localStorage).some((k) => k.startsWith("near-wallet-selector") || k.includes("near_app_wallet")); } catch { return false; } }
export async function connect() { await initWallet(); modal?.show(); }
export async function disconnect() { const s = await initWallet(); const w = await s.wallet(); await w.signOut(); account = null; notify(); }

/** Turn wallet errors into something a visitor understands. */
export function walletError(e: unknown): string {
  const m = String((e as any)?.message || e || "");
  if (/reject|cancel|denied|closed|User (didn't|did not)/i.test(m)) return "You cancelled in your wallet. Nothing was charged.";
  if (/NotEnoughBalance|insufficient|not enough/i.test(m)) return "Not enough testnet NEAR in your wallet. Top up from the testnet faucet and try again.";
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
 * Redirect wallets (MyNearWallet) send the visitor back with ?transactionHashes=… or ?errorCode=….
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
  const s = await initWallet();
  if (!s.isSignedIn()) { modal?.show(); throw new Error("Connect a wallet first"); }
  const w = await s.wallet();
  const { actionCreators } = await import("@near-js/transactions");
  const res: any = await w.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [actionCreators.functionCall("fund", { role }, 30_000_000_000_000n, BigInt(nearToYocto(amountNear)))],
  } as any);
  const hash = res?.transaction?.hash || res?.transaction_outcome?.id;
  const failed = res?.status && "Failure" in res.status;
  return { hash, ok: !!hash && !failed };
}

/** Buy a listed token. Returns the tx result when the wallet returns one (popup wallets); redirect wallets come back with ?transactionHashes=. */
export async function buy(tokenId: string, priceYocto: string) {
  const s = await initWallet();
  if (!s.isSignedIn()) { modal?.show(); throw new Error("Connect a wallet first"); }
  const w = await s.wallet();
  const { actionCreators } = await import("@near-js/transactions");
  const res: any = await w.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [actionCreators.functionCall("buy", { token_id: tokenId }, 100_000_000_000_000n, BigInt(priceYocto))],
  } as any);
  const hash = res?.transaction?.hash || res?.transaction_outcome?.id;
  const logs: string[] = (res?.receipts_outcome || []).flatMap((r: any) => r?.outcome?.logs || []);
  const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => { try { return JSON.parse(l.slice(11)); } catch { return null; } }).filter(Boolean)
    .flatMap((e: any) => (e.data || []).map((d: any) => ({ standard: e.standard, event: e.event, data: d })));
  const failed = res?.status && "Failure" in res.status;
  return { hash, events, ok: !!hash && !failed, account };
}
