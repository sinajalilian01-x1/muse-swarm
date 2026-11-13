// Create or refill the Critic's bounty purse (bounty.<root>) with ONE payout plus gas.
// The NEAR comes out of the Critic's contract budget: the owner calls withdraw("critic"), then forwards it.
// Keys are read from files outside the repo and never printed.
//   NETWORK=mainnet ROOT=hlpok1lad.tg ROOT_KEY_ENV=/workspace/secrets/muse-swarm/mainnet.env KEYS_OUT=/workspace/secrets/muse-swarm/mainnet/keys.json node scripts/bounty-purse.mjs [--execute]
//   NETWORK=testnet ROOT_KEY_FILE=/workspace/secrets/muse-swarm/museswarm.testnet.json OWNER_KEY_FILE=... KEYS_OUT=/workspace/secrets/muse-swarm/keys.json node scripts/bounty-purse.mjs [--execute]
import fs from "node:fs";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions } from "near-api-js";

const MAIN = process.env.NETWORK === "mainnet";
const ROOT = process.env.ROOT || (MAIN ? "hlpok1lad.tg" : "museswarm.testnet");
const OWNER = process.env.OWNER_ID || (MAIN ? ROOT : `sina.${ROOT}`);
const SWARM = `swarm.${ROOT}`, PURSE = `bounty.${ROOT}`;
const TARGET = 23_500_000_000_000_000_000_000n; // 0.0235 NEAR: one 0.02 payout + gas + the purse's own storage
const EXECUTE = process.argv.includes("--execute");
const provider = new JsonRpcProvider({ url: MAIN ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com" });
const fmt = (y) => (Number(y) / 1e24).toFixed(5);
async function view(account_id) { try { return await provider.query({ request_type: "view_account", finality: "final", account_id }); } catch { return null; } }

async function secret(file, envFile, expect) {
  if (envFile) {
    const { loadMainnetEnv } = await import("/workspace/muse-swarm/tools/mainnet-env.mjs");
    const e = loadMainnetEnv(envFile);
    if (e.NEAR_ACCOUNT_ID !== expect) throw new Error("key file account mismatch");
    return e.NEAR_PRIVATE_KEY.includes(":") ? e.NEAR_PRIVATE_KEY : `ed25519:${e.NEAR_PRIVATE_KEY}`;
  }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return j.private_key || j.full;
}
const send = async (signer, receiverId, acts, label) => {
  const r = await signer.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL" });
  const ok = !!r.status && "SuccessValue" in r.status;
  console.log(`${ok ? "ok " : "ERR"} ${label}  tx ${r.transaction.hash}`);
  if (!ok) throw new Error(JSON.stringify(r.status).slice(0, 300));
};

const pv = await view(PURSE);
const have = pv ? BigInt(pv.amount) : 0n;
const need = pv ? (TARGET > have ? TARGET - have : 0n) : TARGET;
console.log(`purse ${PURSE}: ${pv ? `exists, ${fmt(have)} NEAR` : "missing"}; needs ${fmt(need)} NEAR from the Critic's budget`);
if (!need) process.exit(0);
if (!EXECUTE) { console.log("plan only; add --execute"); process.exit(0); }
const KEYS_OUT = process.env.KEYS_OUT; if (!KEYS_OUT) throw new Error("KEYS_OUT required");
const keys = fs.existsSync(KEYS_OUT) ? JSON.parse(fs.readFileSync(KEYS_OUT, "utf8")) : {};
const rootSk = await secret(process.env.ROOT_KEY_FILE, process.env.ROOT_KEY_ENV, ROOT);
const root = new Account(ROOT, provider, KeyPairSigner.fromSecretKey(rootSk));
const owner = OWNER === ROOT ? root : new Account(OWNER, provider, KeyPairSigner.fromSecretKey(keys[OWNER]?.full || await secret(process.env.OWNER_KEY_FILE)));
await send(owner, SWARM, [actions.functionCall("withdraw", { role: "critic", amount: need.toString() }, 30_000_000_000_000n, 0n)], `withdraw ${fmt(need)} NEAR from the Critic's budget to ${OWNER}`);
if (!pv) {
  const kp = KeyPair.fromRandom("ed25519");
  keys[PURSE] = { full: kp.toString(), note: "bounty purse; holds one payout at a time" };
  fs.writeFileSync(KEYS_OUT, JSON.stringify(keys, null, 2)); fs.chmodSync(KEYS_OUT, 0o600);
  await send(root, PURSE, [actions.createAccount(), actions.transfer(need), actions.addFullAccessKey(kp.getPublicKey())], `create ${PURSE} with ${fmt(need)} NEAR`);
} else {
  await send(owner, PURSE, [actions.transfer(need)], `refill ${PURSE} with ${fmt(need)} NEAR`);
}
const after = await view(PURSE);
console.log(`purse now ${fmt(after.amount)} NEAR, storage ${after.storage_usage} bytes`);
