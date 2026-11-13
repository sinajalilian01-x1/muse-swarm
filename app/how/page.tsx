import { aiMode } from "@/lib/ai";
import { CONTRACT_ID, OWNER_ID, TREASURY_ID, GUARDIAN_ID, COLLECTOR_ID, ROBOT_IDS, accountUrl } from "@/lib/config";

export const metadata = { title: "How it works · Muse Swarm" };
export const dynamic = "force-dynamic";

const STEPS = [
  ["#16A39C", "Curator", "Reads live trends", "Pulls what people are searching right now (Google Trends daily RSS, US & UK) and what builders discuss (Hacker News), skips unsafe topics, and writes a short art brief. Then it opens a job on-chain with curator_open_job. Only one job runs at a time, and stale jobs expire after 10 minutes."],
  ["#F47A38", "Painter", "Paints and pins to IPFS", "Turns the brief into an 800×1000 artwork, pins it to IPFS through Pinata, and records the CID with painter_submit. Its AI fee goes to the treasury, and the storage it adds is charged to its own budget."],
  ["#E9AE1C", "Critic", "Scores it, and the contract gates the mint", "Looks at the finished image and gives a score with a one-line review. critic_review mints a NEP-171 NFT only when the score is 7.0 or higher. Below that, the work is rejected for good and stays unminted in the gallery."],
  ["#E86A8C", "Seller", "Prices and lists", "Prices the NFT from the score and recent demand. The contract refuses anything outside the owner's floor and max price. Then it lists the NFT with seller_list."],
  ["#13243F", "Collector", "Buys, and the contract splits the money", "Anyone with a NEAR testnet wallet can call buy. The contract sends the token, pays the owner 30%, and adds 10/30/15/15% to the curator, painter, critic and seller budgets. Anything above a robot's budget cap is swept to the owner. Robots pay for their next AI calls and gas from these budgets, so the swarm funds itself."],
];

export default function How() {
  const ai = aiMode();
  return (
    <div className="page">
      <h1 className="t">How it works</h1>
      <p className="sub">Muse Swarm is a small art business run by four AI robots. Each robot is its own NEAR account with its own budget. The owner sets the rules once, and a smart contract enforces them on every move.</p>
      <div className="steps sec">
        {STEPS.map(([c, n, t, p], i) => (
          <div className="card" key={n}><div className="n" style={{ background: c }}>{i + 1}</div><div><b style={{ fontSize: 17 }}>{n}: {t}</b><p>{p}</p></div></div>
        ))}
      </div>

      <section className="sec">
        <h2>Architecture</h2>
        <pre className="diagram">{`  visitor ──"Run a real cycle"──▶ Next.js API (Vercel)                         NEAR testnet
                                 │  one step = one robot tx                ┌───────────────────────────────┐
  Google Trends / Hacker News ─▶ │  curator ── FC key ───────────────────▶ │ ${CONTRACT_ID.padEnd(29)} │
  ${(ai.nearAi ? "NEAR AI Cloud (LLM/image/VLM)" : "fallback brains (no AI key)").padEnd(28)} ─▶ │  painter ── FC key ── pin to IPFS ────▶ │  rules · budgets · jobs       │
  Pinata IPFS ◀───────────────── │  critic  ── FC key ── score ≥ 7.0? ───▶ │  NEP-171 NFTs + NEP-297 events│
                                 │  seller  ── FC key ── floor ≤ p ≤ max ▶ │  buy() → on-chain split       │
  wallet (Wallet Selector) ──────┼──────────────────── buy ──────────────▶ │  fees → treasury              │
                                 │  guardian ─ FC key ── pause ≤ 120 s ──▶ │  kill switch (owner)          │
  studio / gallery / ledger ◀── view calls + FastNear tx API ◀───────────── └───────────────────────────────┘`}</pre>
      </section>

      <section className="sec">
        <h2>Guardrails</h2>
        <div className="grid g3">
          {[
            ["Function-call keys only", "Robot keys can call only their own method (plus robot_refuel). They can't send NEAR, deploy code or add keys."],
            ["Budgets, caps and a floor", "A daily spend cap and a per-call fee cap for each robot, a jobs-per-day limit, a minimum and maximum price, and a budget cap with sweeps to the owner."],
            ["Kill switch", "The owner can freeze every robot action. For the public demo, a guardian can pause the swarm for up to 120 s, and the pause always releases itself."],
            ["No public budget drain", "Running a cycle is rate-limited per visitor, and only one job runs at a time across the whole swarm. Only the server holds the robot keys, and a signed driver token stops two visitors driving the same job."],
            ["Nothing stranded", "AI fees go to a treasury account rather than piling up on keys that can't withdraw. The owner can withdraw any robot's budget."],
            ["Lean storage", "Each robot pays for the storage it adds. NFT metadata holds only the IPFS CID, title and short text, and the image itself lives on IPFS."],
          ].map(([t, p]) => <div className="card" key={t}><b>{t}</b><p className="k" style={{ marginTop: 6, lineHeight: 1.5 }}>{p}</p></div>)}
        </div>
      </section>

      <section className="sec">
        <h2>What&apos;s real, and what&apos;s a fallback</h2>
        <div className="card" style={{ lineHeight: 1.6 }}>
          <p><span className="pill ok">real</span> The contract, the robot accounts and keys, and every tx, budget, mint, listing, sale and split, all on NEAR testnet. The live trends. IPFS pinning. Wallet purchases.</p>
          <p style={{ marginTop: 8 }}><span className={`pill ${ai.nearAi ? "ok" : "listed"}`}>{ai.nearAi ? "real" : "fallback"}</span> AI brains: <b>{ai.provider}</b>. Curator: {ai.curator}. Painter: {ai.painter}. Critic: {ai.critic}.{!ai.nearAi && " The code already calls NEAR AI Cloud (Qwen3.6 for briefs, FLUX.2 for images, Qwen3-VL for critique) as soon as NEAR_AI_API_KEY is set. Until then, deterministic low-poly painting and a measured critic stand in, and their fees on-chain are labeled \"fallback\"."}</p>
          <p style={{ marginTop: 8 }}><span className="pill listed">testnet</span> All money is test NEAR. The demo collector ({COLLECTOR_ID}) is the owner&apos;s own test account and is shown separately in the P&amp;L.</p>
        </div>
      </section>

      <section className="sec">
        <h2>Accounts</h2>
        <div className="card kv" style={{ marginTop: 0 }}>
          {[["Contract", CONTRACT_ID], ...Object.entries(ROBOT_IDS).map(([r, id]) => [r[0].toUpperCase() + r.slice(1), id]), ["Owner", OWNER_ID], ["Treasury", TREASURY_ID], ["Guardian", GUARDIAN_ID], ["Demo collector", COLLECTOR_ID]].map(([k, v]) => [<span key={k + "k"}>{k}</span>, <a key={k} className="lnk mono" href={accountUrl(v)} target="_blank" rel="noreferrer">{v}</a>])}
        </div>
      </section>
      <p className="foot2">Muse Swarm is a NEAR hackathon project by Sina Jalilian. Sina&apos;s other entry is Atelier One, a single-agent studio and a separate project.</p>
    </div>
  );
}
