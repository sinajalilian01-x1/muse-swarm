"use client";
// NEAR Wallet Selector (testnet): connect a wallet and buy a listed artwork directly from the swarm contract.
import { CONTRACT_ID, NETWORK } from "./config";

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
