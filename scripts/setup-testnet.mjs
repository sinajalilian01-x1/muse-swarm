// One-time testnet setup for Muse Swarm. Creates the swarm contract and every account under ROOT,
// gives each robot function-call-only keys, deletes the robots' full-access keys, funds the swarm.
// Usage: ROOT=museswarm.testnet ROOT_KEY_FILE=~/.near-credentials/testnet/museswarm.testnet.json \
//        KEYS_OUT=/path/outside/repo/keys.json node scripts/setup-testnet.mjs
// Private keys are written ONLY to KEYS_OUT (outside the repo). Never commit them.
import fs from "node:fs";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, nearToYocto } from "near-api-js";

const ROOT = process.env.ROOT || "museswarm.testnet";
const rootKey = JSON.parse(fs.readFileSync(process.env.ROOT_KEY_FILE, "utf8")).private_key;
const OUT = process.env.KEYS_OUT;
if (!OUT) throw new Error("KEYS_OUT required");
const WASM = process.env.WASM || new URL("../../contract-target/near/muse_swarm.wasm", import.meta.url).pathname;
const provider = new JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
const keys = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const save = () => { fs.writeFileSync(OUT, JSON.stringify(keys, null, 2)); fs.chmodSync(OUT, 0o600); };
const acct = (id, sk) => new Account(id, provider, KeyPairSigner.fromSecretKey(sk));
const root = acct(ROOT, rootKey);
const id = (n) => `${n}.${ROOT}`;
const SWARM = id("swarm");
const exists = async (a) => { try { await provider.viewAccount({ accountId: a }); return true; } catch { return false; } };
const send = async (signer, receiverId, acts, label) => {
  const r = await signer.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL" });
  const ok = !!r.status && "SuccessValue" in r.status;
  console.log(`${ok ? "ok " : "ERR"} ${label}  tx ${r.transaction.hash}`);
  if (!ok) throw new Error(JSON.stringify(r.status).slice(0, 400));
  return r;
};

async function create(name, near) {
  const a = id(name);
  if (await exists(a)) { console.log(`skip ${a} (exists)`); return a; }
  const kp = KeyPair.fromRandom("ed25519");
  keys[a] = { full: kp.toString() }; save();
  await send(root, a, [actions.createAccount(), actions.transfer(BigInt(nearToYocto(near))), actions.addFullAccessKey(kp.getPublicKey())], `create ${a} with ${near} NEAR`);
  return a;
}

async function restrict(a, methods, n = 3) {
  const full = keys[a].full;
  if (!full) { console.log(`skip restrict ${a}`); return; }
  const fc = Array.from({ length: n }, () => KeyPair.fromRandom("ed25519"));
  keys[a].fc = fc.map((k) => k.toString()); save();
  const acts = fc.map((k) => actions.addFunctionCallAccessKey(k.getPublicKey(), SWARM, methods, undefined));
  await send(acct(a, full), a, acts, `add ${n} FC keys to ${a} for [${methods.join(", ")}]`);
  await send(acct(a, full), a, [actions.deleteKey(KeyPair.fromString(full).getPublicKey())], `delete full-access key of ${a}`);
  keys[a].full = null; keys[a].fullDeleted = true; save();
}

const robots = { curator: ["curator_open_job", "robot_refuel"], painter: ["painter_submit", "robot_refuel"], critic: ["critic_review", "robot_refuel"], seller: ["seller_list", "robot_refuel"] };
const N = (x) => nearToYocto(x).toString();

// 1. accounts
await create("swarm", "4.5");
for (const r of Object.keys(robots)) await create(r, "0.6");
await create("treasury", "0.2");
await create("guardian", "0.3");
await create("sina", "3");
await create("collector", "3");

// 2. deploy + init
if (!keys[SWARM].deployed) {
  await send(acct(SWARM, keys[SWARM].full), SWARM, [
    actions.deployContract(fs.readFileSync(WASM)),
    actions.functionCall("new", {
      owner_id: id("sina"), treasury_id: id("treasury"), guardian_id: id("guardian"),
      curator_id: id("curator"), painter_id: id("painter"), critic_id: id("critic"), seller_id: id("seller"),
      rules: {
        floor: N("0.05"), max_price: N("0.25"), score_threshold: 70,
        daily_cap: N("0.3"), fee_cap: N("0.02"), budget_cap: N("1"), max_jobs_per_day: 60,
        split: { owner: 3000, curator: 1000, painter: 3000, critic: 1500, seller: 1500 },
      },
    }, 100_000_000_000_000n, 0n),
  ], `deploy + init ${SWARM}`);
  keys[SWARM].deployed = true; save();
}

// 3. function-call-only keys for the robots and the guardian
for (const [r, m] of Object.entries(robots)) if (!keys[id(r)].fullDeleted) await restrict(id(r), m);
if (!keys[id("guardian")].fullDeleted) await restrict(id("guardian"), ["guardian_pause"], 2);

// 4. the owner funds the robots' budgets (0.5 NEAR each)
if (!keys[id("sina")].funded) {
  await send(acct(id("sina"), keys[id("sina")].full), SWARM, [actions.functionCall("fund", {}, 30_000_000_000_000n, BigInt(N("2")))], "owner funds the 4 robot budgets with 2 NEAR");
  keys[id("sina")].funded = true; save();
}
console.log("done. keys in", OUT);
