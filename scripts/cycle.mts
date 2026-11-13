// Run one full real cycle from the terminal: Curator -> Painter -> Critic -> Seller (-> demo collector buys).
// Usage: npm run cycle            (reads .env.local)
//        npm run cycle -- --no-buy
import { readFileSync, existsSync } from "node:fs";
if (existsSync(".env.local")) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }

const { advance } = await import("../lib/swarm");
const { collectorCall } = await import("../lib/near");
const { txUrl, toNear } = await import("../lib/config");

let driver: string | undefined;
for (let i = 0; i < 6; i++) {
  const r = await advance(driver);
  driver = r.driver || driver;
  console.log(`\n[${r.stage}] ${r.say || r.error || ""}`);
  if (r.job) console.log(`  job #${r.job.id} "${r.job.trend}" status=${r.job.status}${r.job.media ? ` media=${r.job.media}` : ""}${r.job.score ? ` score=${r.job.score}` : ""}`);
  if (r.extra) console.log("  " + JSON.stringify(r.extra).slice(0, 300));
  for (const t of r.txs) console.log(`  ${t.ok ? "ok " : "ERR"} ${t.method} by ${t.signerId}: ${txUrl(t.hash)}${t.error ? " " + t.error : ""}`);
  if (["listed", "rejected", "error", "paused", "busy"].includes(r.stage)) {
    if (r.stage === "listed" && r.job?.token_id && !process.argv.includes("--no-buy")) {
      const tx = await collectorCall("buy", { token_id: r.job.token_id }, r.job.price);
      console.log(`\n[sold] demo collector paid ${toNear(r.job.price, 3)} NEAR: ${tx.ok ? "ok" : "ERR " + tx.error} ${txUrl(tx.hash)}`);
      for (const e of tx.events || []) if (e.event === "split_paid") console.log("  split:", JSON.stringify(e.data));
    }
    break;
  }
}
