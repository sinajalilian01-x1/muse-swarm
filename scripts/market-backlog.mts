// Seller markets the back catalog: plan + Mintbase cross-listing for listed works that have none yet.
// Usage: npm run market-backlog   (reads .env.local)
import { readFileSync, existsSync } from "node:fs";
if (existsSync(".env.local")) for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { maybeMarketBacklog } = await import("../lib/swarm");
const { txUrl } = await import("../lib/config");
for (let i = 0; i < 10; i++) {
  const tx = await maybeMarketBacklog();
  if (!tx) { console.log("backlog done"); break; }
  console.log(tx.ok ? "ok " : "ERR", txUrl(tx.hash), tx.error || "", (tx.events || []).map((e) => e.event).join(","));
}
