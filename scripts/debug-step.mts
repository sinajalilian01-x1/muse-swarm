// Debug: run the Curator's first step and print the full underlying error chain.
const near = await import("../lib/near");
try {
  const r = await near.robotCall("curator", "robot_refuel", { amount: "0" });
  console.log("robot_refuel result", r.ok, r.error, r.hash);
} catch (e: any) { console.log("ERR", e?.message); let c = e?.cause; while (c) { console.log("cause:", c?.message || c); c = c.cause; } if (e?.errors) for (const x of e.errors) console.log("sub:", x?.message || x); }
