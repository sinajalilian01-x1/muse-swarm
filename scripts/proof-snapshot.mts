// Regenerate the verified fallback snapshot for /proof from live mainnet data, and verify every listed tx
// independently against NEAR RPC (EXPERIMENTAL_tx_status: must exist and must have succeeded).
// Run: NEXT_PUBLIC_NETWORK=mainnet NEXT_PUBLIC_SWARM_ROOT=hlpok1lad.tg NEXT_PUBLIC_OWNER_ID=hlpok1lad.tg npm run proof:snapshot
import { writeFileSync } from "fs";
import { buildProof } from "../lib/proof";

// Archival RPC: regular nodes drop tx results after ~2-3 days.
const RPCS = ["https://archival-rpc.mainnet.fastnear.com", "https://archival-rpc.mainnet.near.org"];
async function txOk(hash: string, signer: string) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(RPCS[i % RPCS.length], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "EXPERIMENTAL_tx_status", params: { tx_hash: hash, sender_account_id: signer, wait_until: "NONE" } }) });
      const j = await r.json();
      if (!j.result) throw new Error(JSON.stringify(j.error || {}).slice(0, 120));
      const outs = [j.result.transaction_outcome, ...(j.result.receipts_outcome || [])];
      return !outs.some((o: any) => o?.outcome?.status && "Failure" in o.outcome.status) && !("Failure" in (j.result.status || {}));
    } catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 800)); }
  }
  return false;
}

const p = await buildProof();
const all = new Map<string, string>();
for (const list of Object.values(p.groups)) for (const t of list) all.set(t.hash, t.signer);
let checked = 0; const bad: string[] = [];
const entries = [...all];
for (let i = 0; i < entries.length; i += 6) {
  await Promise.all(entries.slice(i, i + 6).map(async ([h, s]) => { if (!(await txOk(h, s).catch(() => false))) bad.push(h); checked++; }));
}
if (bad.length) { console.error(`NOT verified (${bad.length}):`, bad.join(" ")); process.exit(1); }
writeFileSync(new URL("../lib/proof-snapshot.json", import.meta.url), JSON.stringify({ ...p, source: "snapshot", verifiedTxs: checked }, null, 1));
console.log(`snapshot written: ${checked} txs verified on mainnet RPC; counts`, p.counts);
