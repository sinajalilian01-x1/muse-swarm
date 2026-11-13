// Network-aware setup for Muse Swarm (testnet or MAINNET). DRY RUN BY DEFAULT: prints every step and the NEAR it costs.
//
//   NETWORK=mainnet ROOT=museswarm.near OWNER_ID=<sina's mainnet account> node scripts/setup-network.mjs          # plan only
//   NETWORK=mainnet ... ROOT_KEY_FILE=... KEYS_OUT=/outside/repo/keys.json \
//     CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL node scripts/setup-network.mjs --execute                                 # real
//
// Mainnet spends real NEAR. It refuses to run without --execute AND CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL.
// Private keys are written ONLY to KEYS_OUT (outside the repo, chmod 600). Never commit them.
// Owner-only steps (fund, enable_approvals) are signed with OWNER_KEY_FILE if given, otherwise printed as NEAR CLI commands
// for the owner to run from their own wallet.
import fs from "node:fs";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, nearToYocto } from "near-api-js";

const NETWORK = process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
const MAIN = NETWORK === "mainnet";
const EXECUTE = process.argv.includes("--execute");
if (EXECUTE && MAIN && process.env.CONFIRM_MAINNET !== "I_HAVE_SINAS_APPROVAL") {
  console.error("Refusing: mainnet spends real NEAR. Set CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL after Sina approves and funds.");
  process.exit(2);
}
const ROOT = process.env.ROOT || (MAIN ? "museswarm.near" : "museswarm.testnet");
if (MAIN === ROOT.endsWith(".testnet")) throw new Error(`ROOT ${ROOT} does not match NETWORK ${NETWORK}`);
const id = (n) => `${n}.${ROOT}`;
const SWARM = id("swarm");
const OWNER = process.env.OWNER_ID || id("sina");
const OWNER_IS_SUB = OWNER === id("sina");
const OWNER_IS_ROOT = OWNER === ROOT;
const WNEAR = MAIN ? "wrap.near" : "wrap.testnet";
const MARKET = MAIN ? "simple.market.mintbase1.near" : "market-v2-beta.mintspace2.testnet";
const RPC = process.env.RPC || (MAIN ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com");
const WASM = process.env.WASM || new URL("../contract/target/near/muse_swarm.wasm", import.meta.url).pathname;
const provider = new JsonRpcProvider({ url: RPC });

// Amounts (NEAR). Mainnet defaults are lean; override with env.
const A = {
  swarm: process.env.SWARM_NEAR || (MAIN ? "4.1" : "4.5"),     // ~3.94 NEAR locked by the 394 KB wasm + initial state headroom
  robot: process.env.ROBOT_NEAR || (MAIN ? "0.05" : "0.6"),    // gas wallet per robot (testnet robots used ~0.01 each in 30 jobs); refuels from budget
  treasury: MAIN ? "0.01" : "0.2",                              // small accounts (<770 bytes) need no storage balance
  guardian: MAIN ? "0.02" : "0.3",
  sina: MAIN ? "0" : "3",                                       // mainnet owner is Sina's own existing account
  collector: MAIN ? "0" : "3",                                  // no demo collector on mainnet
  fund: process.env.FUND_NEAR || (MAIN ? "0.4" : "2"),          // robot budgets, split 4 ways by the contract
};
const N = (x) => nearToYocto(x).toString();
const rules = MAIN
  ? { floor: N(process.env.FLOOR || "0.05"), max_price: N(process.env.MAX_PRICE || "0.5"), score_threshold: 70, daily_cap: N(process.env.DAILY_CAP || "0.1"), fee_cap: N("0.01"),
      budget_cap: N("0.25"), max_jobs_per_day: Number(process.env.MAX_JOBS || 12), split: { owner: 3000, curator: 1000, painter: 3000, critic: 1500, seller: 1500 } }
  : { floor: N("0.05"), max_price: N("0.25"), score_threshold: 70, daily_cap: N("0.3"), fee_cap: N("0.02"), budget_cap: N("1"), max_jobs_per_day: 60,
      split: { owner: 3000, curator: 1000, painter: 3000, critic: 1500, seller: 1500 } };
const robots = { curator: ["curator_open_job", "robot_refuel"], painter: ["painter_submit", "robot_refuel"], critic: ["critic_review", "robot_refuel"], seller: ["seller_list", "robot_refuel"] };

const exists = async (a) => { try { await provider.viewAccount({ accountId: a }); return true; } catch { return false; } };
let total = 0;
const plan = [];
const step = (label, near = 0, fn = null) => { total += Number(near); plan.push({ label, near, fn }); };

let keys = {}, OUT = process.env.KEYS_OUT || (MAIN ? "/workspace/secrets/muse-swarm/mainnet/keys.json" : undefined), root, owner;
// Root key: a near-cli JSON file (ROOT_KEY_FILE) or an env file with NEAR_PRIVATE_KEY (ROOT_KEY_ENV). Never printed.
async function rootSecret() {
  if (process.env.ROOT_KEY_ENV) {
    const { loadMainnetEnv } = await import("/workspace/muse-swarm/tools/mainnet-env.mjs");
    const e = loadMainnetEnv(process.env.ROOT_KEY_ENV);
    if (e.NEAR_ACCOUNT_ID !== ROOT) throw new Error("ROOT_KEY_ENV account does not match ROOT");
    return e.NEAR_PRIVATE_KEY.includes(":") ? e.NEAR_PRIVATE_KEY : `ed25519:${e.NEAR_PRIVATE_KEY}`;
  }
  return JSON.parse(fs.readFileSync(process.env.ROOT_KEY_FILE, "utf8")).private_key;
}
const save = () => { fs.writeFileSync(OUT, JSON.stringify(keys, null, 2)); fs.chmodSync(OUT, 0o600); };
const acct = (a, sk) => new Account(a, provider, KeyPairSigner.fromSecretKey(sk));
const send = async (signer, receiverId, acts, label) => {
  const r = await signer.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL" });
  const ok = !!r.status && "SuccessValue" in r.status;
  console.log(`${ok ? "ok " : "ERR"} ${label}  tx ${r.transaction.hash}`);
  if (!ok) throw new Error(JSON.stringify(r.status).slice(0, 400));
  return r;
};
if (EXECUTE) {
  if (!OUT || !(process.env.ROOT_KEY_FILE || process.env.ROOT_KEY_ENV)) throw new Error("--execute needs ROOT_KEY_FILE or ROOT_KEY_ENV, and KEYS_OUT (outside the repo)");
  fs.mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true, mode: 0o700 });
  keys = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  const sk = await rootSecret();
  root = acct(ROOT, sk);
  if (OWNER_IS_ROOT) owner = root;
  else if (process.env.OWNER_KEY_FILE) owner = acct(OWNER, JSON.parse(fs.readFileSync(process.env.OWNER_KEY_FILE, "utf8")).private_key);
}
const ownerStep = (label, method, args, depositNear, gasT = 30) => step(`[owner ${OWNER}] ${label}`, depositNear, async () => {
  if (!owner) {
    console.log(`MANUAL (owner signs): near contract call-function as-transaction ${SWARM} ${method} json-args '${JSON.stringify(args)}' prepaid-gas '${gasT} Tgas' attached-deposit '${depositNear} NEAR' sign-as ${OWNER} network-config ${NETWORK} sign-with-keychain send`);
    return;
  }
  await send(owner, SWARM, [actions.functionCall(method, args, BigInt(gasT) * 10n ** 12n, BigInt(N(String(depositNear))))], label);
});

async function create(name, near) {
  const a = id(name);
  if (await exists(a)) { step(`skip create ${a} (exists)`); return; }
  step(`create ${a} with ${near} NEAR (+ full-access key, stored only in KEYS_OUT)`, near, async () => {
    const kp = KeyPair.fromRandom("ed25519");
    keys[a] = { full: kp.toString() }; save();
    await send(root, a, [actions.createAccount(), actions.transfer(BigInt(N(near))), actions.addFullAccessKey(kp.getPublicKey())], `create ${a}`);
  });
}
function restrict(a, methods, n = 3) {
  step(`${a}: add ${n} function-call keys for [${methods.join(", ")}] on ${SWARM}, then DELETE its full-access key`, 0, async () => {
    if (!keys[a]?.full) { console.log(`skip restrict ${a}`); return; }
    const fc = Array.from({ length: n }, () => KeyPair.fromRandom("ed25519"));
    keys[a].fc = fc.map((k) => k.toString()); save();
    await send(acct(a, keys[a].full), a, fc.map((k) => actions.addFunctionCallAccessKey(k.getPublicKey(), SWARM, methods, undefined)), `FC keys ${a}`);
    await send(acct(a, keys[a].full), a, [actions.deleteKey(KeyPair.fromString(keys[a].full).getPublicKey())], `delete full key ${a}`);
    keys[a].full = null; keys[a].fullDeleted = true; save();
  });
}

// ---- plan
console.log(`Muse Swarm setup · ${NETWORK} · root ${ROOT} · owner ${OWNER} · ${EXECUTE ? "EXECUTE" : "DRY RUN (nothing is sent)"}`);
for (const a of [ROOT, WNEAR, MARKET, ...(MAIN && !OWNER_IS_SUB ? [OWNER] : [])])
  console.log(`  ${a}: ${(await exists(a)) ? "exists" : "MISSING" + (a === ROOT ? " (create it first, e.g. from Sina's wallet; ~0.1 NEAR)" : "")}`);
await create("swarm", A.swarm);
for (const r of Object.keys(robots)) await create(r, A.robot);
await create("treasury", A.treasury);
await create("guardian", A.guardian);
if (OWNER_IS_SUB) await create("sina", A.sina);
if (!MAIN) await create("collector", A.collector);
step(`deploy ${WASM.split("/").pop()} (${(fs.statSync(WASM).size / 1024).toFixed(0)} KB, ~${(fs.statSync(WASM).size / 1e5).toFixed(2)} NEAR storage, paid from the swarm balance) + new(owner ${OWNER}, floor ${(Number(BigInt(rules.floor) / 10n ** 21n) / 1000)} NEAR, max ${(Number(BigInt(rules.max_price) / 10n ** 21n) / 1000)} NEAR)`, 0, async () => {
  if (keys[SWARM]?.deployed) return;
  await send(acct(SWARM, keys[SWARM].full), SWARM, [actions.deployContract(fs.readFileSync(WASM)), actions.functionCall("new", {
    owner_id: OWNER, treasury_id: id("treasury"), guardian_id: id("guardian"),
    curator_id: id("curator"), painter_id: id("painter"), critic_id: id("critic"), seller_id: id("seller"), rules,
  }, 100_000_000_000_000n, 0n)], `deploy + init ${SWARM}`);
  keys[SWARM].deployed = true; save();
});
step(`register ${SWARM} on ${WNEAR} (storage_deposit 0.00125 NEAR) so NEAR Intents / wNEAR commissions can arrive`, 0.00125, async () => {
  await send(acct(SWARM, keys[SWARM].full), WNEAR, [actions.functionCall("storage_deposit", { account_id: SWARM, registration_only: true }, 30_000_000_000_000n, BigInt(N("0.00125")))], `wNEAR storage ${SWARM}`);
});
for (const [r, m] of Object.entries(robots)) restrict(id(r), m);
restrict(id("guardian"), ["guardian_pause"], 2);
ownerStep("enable NEP-178 approvals (Mintbase cross-listing)", "enable_approvals", {}, 0);
ownerStep(`fund the 4 robot budgets with ${A.fund} NEAR`, "fund", {}, A.fund);
step(`(optional, recommended on mainnet) remove ${SWARM}'s full-access key after checks, or keep it in a hardware wallet: it can upgrade the contract`);

console.log("");
for (const [i, s] of plan.entries()) console.log(`${String(i + 1).padStart(2)}. ${s.label}${Number(s.near) ? `  · ${s.near} NEAR` : ""}`);
const gas = 0.003 * plan.length;
const rootBal = Number(BigInt((await provider.viewAccount({ accountId: ROOT }).catch(() => ({ amount: "0" }))).amount) / 10n ** 21n) / 1000;
console.log(`\nNEAR moved by these steps: ~${total.toFixed(3)} NEAR, plus gas (~${gas.toFixed(3)} NEAR, ~${plan.length} txs). ${ROOT} balance: ${rootBal} NEAR.`);
const need = total + gas + 0.05; // + buffer for the root's own storage
if (rootBal < need) console.log(`INSUFFICIENT: ${ROOT} needs ≥ ${need.toFixed(2)} NEAR; top up at least ${(need - rootBal).toFixed(2)} NEAR.`);
console.log(`Then set Vercel env: NEXT_PUBLIC_NETWORK=${NETWORK} NEXT_PUBLIC_SWARM_ROOT=${ROOT}${OWNER_IS_SUB ? "" : ` NEXT_PUBLIC_OWNER_ID=${OWNER}`} + CURATOR_KEYS, PAINTER_KEYS, CRITIC_KEYS, SELLER_KEYS, GUARDIAN_KEYS (the FC keys from KEYS_OUT); no COLLECTOR_KEY on mainnet.`);
if (!EXECUTE) { console.log("\nDry run only. Nothing was sent."); process.exit(0); }
if (rootBal < need) { console.error("Refusing to execute: insufficient balance (nothing was sent)."); process.exit(3); }
for (const s of plan) if (s.fn) await s.fn();
console.log("done. keys in", OUT);
