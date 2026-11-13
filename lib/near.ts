import "server-only";
import { Account, JsonRpcProvider, FailoverRpcProvider, KeyPairSigner, actions } from "near-api-js";
import { COLLECTOR_ID, CONTRACT_ID, GUARDIAN_ID, ROBOT_IDS, RPC_URLS, type Role, NETWORK } from "./config";
import { extractEvents } from "./events";
import type { TxInfo } from "./types";

type KeyStr = `ed25519:${string}`;
let _provider: FailoverRpcProvider | null = null;
export function provider() {
  if (!_provider) _provider = new FailoverRpcProvider(RPC_URLS.map((url) => new JsonRpcProvider({ url })));
  return _provider;
}

/** Public RPCs rate-limit bursts (e.g. the Robots page reads ~20 accounts at once): retry transient errors with a short backoff. */
const TRANSIENT = /429|rate.?limit|too many|timeout|timed out|fetch failed|ECONNRESET|503|502/i;
async function retrying<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries - 1 || !TRANSIENT.test(String((e as Error)?.message || e))) throw e;
      await new Promise((r) => setTimeout(r, 350 * (i + 1) + Math.random() * 250));
    }
  }
}

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return retrying(async () => (await provider().callFunction({ contractId: CONTRACT_ID, method, args } as any)) as T);
}

export async function viewOn<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  return retrying(async () => (await provider().callFunction({ contractId, method, args } as any)) as T);
}

const keys = (env: string | undefined): KeyStr[] => (env || "").split(",").map((s) => s.trim()).filter(Boolean) as KeyStr[];
/** Function-call-only keys per robot (comma separated), e.g. CURATOR_KEYS. */
const ROBOT_KEYS: Record<Role, () => KeyStr[]> = {
  curator: () => keys(process.env.CURATOR_KEYS),
  painter: () => keys(process.env.PAINTER_KEYS),
  critic: () => keys(process.env.CRITIC_KEYS),
  seller: () => keys(process.env.SELLER_KEYS),
};
export const hasRobotKeys = () => (Object.keys(ROBOT_KEYS) as Role[]).every((r) => ROBOT_KEYS[r]().length > 0);

function errText(e: unknown): string {
  if (!e) return "unknown error";
  if (typeof e === "string") return e;
  const s = (() => { try { return JSON.stringify(e, Object.getOwnPropertyNames(e as object)); } catch { return String(e); } })();
  const m = s.match(/Smart contract panicked: ([^"\\]+)/);
  if (m) return m[1];
  if (e instanceof Error) return e.message;
  return s.slice(0, 300);
}
function hashFromError(e: unknown): string | undefined {
  const s = (() => { try { return JSON.stringify(e, Object.getOwnPropertyNames(e as object)); } catch { return String(e); } })();
  return s.match(/"(?:transaction_hash|txHash|hash)"\s*:\s*"([1-9A-HJ-NP-Za-km-z]{43,44})"/)?.[1];
}

export function parseOutcome(res: any, signerId: string, method?: string): TxInfo & { returnValue?: any } {
  const hash: string = res?.transaction?.hash || res?.transaction_outcome?.id;
  const status = res?.status || {};
  let ok = "SuccessValue" in status;
  let error: string | undefined;
  if ("Failure" in status) { ok = false; error = errText(status.Failure); }
  for (const r of res?.receipts_outcome || []) {
    const st = r?.outcome?.status || {};
    if ("Failure" in st) { ok = false; error = error || errText(st.Failure); }
  }
  let returnValue: any;
  if (status.SuccessValue) { try { returnValue = JSON.parse(Buffer.from(status.SuccessValue, "base64").toString()); } catch {} }
  return { hash, ok, error, events: extractEvents(res), returnValue, signerId, method, at: Date.now() };
}

async function call(accountId: string, keyList: KeyStr[], method: string, args: object, deposit = "0", gas = 100_000_000_000_000n) {
  if (!keyList.length) throw new Error(`No key configured for ${accountId}`);
  let lastErr: unknown;
  const order = [...keyList].sort(() => Math.random() - 0.5);
  for (let attempt = 0; attempt < Math.max(3, order.length); attempt++) {
    const key = order[attempt % order.length];
    const acct = new Account(accountId, provider(), KeyPairSigner.fromSecretKey(key));
    try {
      const res = await acct.signAndSendTransaction({
        receiverId: CONTRACT_ID,
        actions: [actions.functionCall(method, args, gas, BigInt(deposit))],
        waitUntil: "EXECUTED_OPTIMISTIC",
        throwOnFailure: false,
      } as any);
      return parseOutcome(res, accountId, method);
    } catch (e) {
      lastErr = e;
      const msg = errText(e);
      const h = hashFromError(e);
      if (h) return { hash: h, ok: false, error: msg, events: [], signerId: accountId, method, at: Date.now() } as TxInfo & { returnValue?: any };
      if (!/nonce|expired|timeout|fetch|429|503|502|Too Many/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));
    }
  }
  throw new Error(errText(lastErr));
}

/** Robot steps burn 4–13 Tgas. Mainnet reserves prepaid gas at a pessimistic price (~0.001 NEAR per Tgas), so keep it tight there. */
const ROBOT_GAS = NETWORK === "mainnet" ? 30_000_000_000_000n : 100_000_000_000_000n;
export const robotCall = (role: Role, method: string, args: object, gas?: bigint) => call(ROBOT_IDS[role], ROBOT_KEYS[role](), method, args, "0", gas ?? ROBOT_GAS);
export const guardianCall = (method: string, args: object) => call(GUARDIAN_ID, keys(process.env.GUARDIAN_KEYS), method, args, "0", 30_000_000_000_000n);
export const collectorCall = (method: string, args: object, deposit: string) => call(COLLECTOR_ID, keys(process.env.COLLECTOR_KEY), method, args, deposit, 100_000_000_000_000n);

export async function accountBalance(id: string): Promise<string> {
  // Direct view_account with a per-provider timeout. An account that does not exist (e.g. no demo collector on
  // mainnet) is a definite answer (0), not a provider failure, so it must not walk every provider with backoff.
  for (const url of RPC_URLS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }) });
      const j = await r.json();
      if (j.result) return String(j.result.amount ?? "0");
      if (/UNKNOWN_ACCOUNT|does not exist/i.test(JSON.stringify(j.error || ""))) return "0";
    } catch {}
  }
  return "0";
}

export async function accessKeys(id: string): Promise<{ public_key: string; permission: any }[]> {
  for (const url of RPC_URLS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_access_key_list", finality: "final", account_id: id } }) });
      const j = await r.json();
      if (j.result) return j.result.keys.map((k: any) => ({ public_key: k.public_key, permission: k.access_key.permission }));
    } catch {}
  }
  return [];
}
