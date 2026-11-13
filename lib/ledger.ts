import "server-only";
import { CONTRACT_ID, TX_API } from "./config";
import { eventsFromLogs } from "./events";
import type { ChainEvent } from "./types";

export interface LedgerTx {
  hash: string; at: number; signer: string; method: string; args: Record<string, unknown> | null; deposit: string;
  ok: boolean; error?: string; events: ChainEvent[]; burnt: string; block: number;
}

const detailCache = new Map<string, LedgerTx>();
let listCache: { t: number; v: { hash: string; block: number; at: number }[]; count: number } | null = null;

async function post(path: string, body: unknown) {
  const r = await fetch(`${TX_API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`tx api ${r.status}`);
  return r.json();
}

function parse(t: any): LedgerTx {
  const tx = t.transaction;
  const fc = (tx.actions || []).map((a: any) => a.FunctionCall).find(Boolean);
  let args: Record<string, unknown> | null = null;
  if (fc?.args) { try { args = JSON.parse(Buffer.from(fc.args, "base64").toString()); } catch {} }
  const outcomes = [t.execution_outcome, ...(t.receipts || []).map((r: any) => r.execution_outcome)].filter(Boolean);
  let ok = true, error: string | undefined, burnt = 0n;
  const logs: string[] = [];
  for (const o of outcomes) {
    const st = o.outcome?.status || {};
    if ("Failure" in st) { ok = false; const s = JSON.stringify(st.Failure); error = error || (s.match(/Smart contract panicked: ([^"\\]+)/)?.[1] ?? s.slice(0, 160)); }
    burnt += BigInt(o.outcome?.tokens_burnt || "0");
    logs.push(...(o.outcome?.logs || []));
  }
  const action = (tx.actions || [])[0];
  const method = fc?.method_name || (typeof action === "string" ? action : Object.keys(action || {})[0] || "?");
  const deposit = fc?.deposit || action?.Transfer?.deposit || "0";
  const ts = Number(t.execution_outcome?.block_timestamp || 0) / 1e6;
  const events = eventsFromLogs(logs);
  const shown = events.some((e) => e.event === "repriced") ? "repriced"
    : tx.receiver_id !== CONTRACT_ID && method === "buy" ? "nft_transfer_payout"
    : events.some((e) => e.event === "commissioned") && tx.receiver_id !== CONTRACT_ID ? "commission_wnear"
    : events.some((e) => e.event === "commission_delivered") ? "delivered"
    : method === "seller_list" && events.some((e) => e.event === "marketing_plan") && !events.some((e) => e.event === "listed") ? "marketed" : method;
  return { hash: tx.hash, at: ts, signer: tx.signer_id, method: shown, args, deposit: String(deposit), ok, error, events, burnt: burnt.toString(), block: t.execution_outcome?.block_height || 0 };
}

async function details(hashes: string[]): Promise<LedgerTx[]> {
  const missing = hashes.filter((h) => !detailCache.has(h));
  for (let i = 0; i < missing.length; i += 20) {
    const j = await post("/v0/transactions", { tx_hashes: missing.slice(i, i + 20) });
    for (const t of j.transactions || []) { const p = parse(t); detailCache.set(p.hash, p); }
  }
  return hashes.map((h) => detailCache.get(h)).filter((x): x is LedgerTx => !!x);
}

/** Every transaction that touched the swarm contract, newest first, rebuilt from chain data (FastNear tx API). */
export async function ledger(limit = 60, offset = 0): Promise<{ total: number; txs: LedgerTx[] }> {
  if (!listCache || Date.now() - listCache.t > 6000) {
    const j = await post("/v0/account", { account_id: CONTRACT_ID });
    listCache = { t: Date.now(), count: j.txs_count ?? j.account_txs.length, v: j.account_txs.map((a: any) => ({ hash: a.transaction_hash, block: a.tx_block_height, at: Number(a.tx_block_timestamp) / 1e6 })) };
  }
  const page = listCache.v.slice(offset, offset + limit).map((x) => x.hash);
  return { total: listCache.count, txs: await details(page) };
}
