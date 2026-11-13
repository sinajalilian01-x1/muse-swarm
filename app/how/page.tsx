/* eslint-disable @next/next/no-html-link-for-pages */
import { aiMode } from "@/lib/ai";
import { getSwarm } from "@/lib/swarm";
import { CONTRACT_ID, OWNER_ID, TREASURY_ID, GUARDIAN_ID, COLLECTOR_ID, ROBOT_IDS, MARKET_ID, accountUrl, NETWORK, NET_NAME, DEV_HISTORY, nftUrl } from "@/lib/config";

export const metadata = { title: "How it works · Muse Swarm" };
export const dynamic = "force-dynamic";

const STEPS = [
  ["#16A39C", "Curator", "Reads live trends", "Pulls what people are searching right now (Google Trends daily RSS, US & UK) and what builders discuss (Hacker News), skips unsafe topics, and writes a short art brief. Then it opens a job on-chain with curator_open_job. Only one job runs at a time, and stale jobs expire after 10 minutes."],
  ["#F47A38", "Painter", "Paints and pins to IPFS", "Turns the brief into an 800×1000 artwork, pins it to IPFS through Pinata, and records the CID with painter_submit. Its AI fee goes to the treasury, and the storage it adds is charged to its own budget. It also pays the Curator 0.002 NEAR for the brief, budget to budget inside the contract: agents hire agents."],
  ["#E9AE1C", "Critic", "Scores it, and the contract gates the mint", "Looks at the finished image and gives a score with a one-line review. critic_review mints a NEP-171 NFT only when the score is 7.0 or higher. Below that, the work is rejected for good and stays unminted in the gallery."],
  ["#E86A8C", "Seller", "Prices, markets and lists, beyond this website", "Prices the NFT from the score and recent demand (the contract refuses anything outside the owner's floor and max price) and pays the Critic 0.001 NEAR for the appraisal. With the Curator's trend context it writes a marketing plan: pitch, audience, channel, best time, hashtags and two X post drafts. The plan is pinned to IPFS as the token's NEP-177 reference and logged on-chain as a marketing_plan event. In the same seller_list call the contract approves Mintbase's market (NEP-178) and lists the NFT there, so it is for sale on our site and on a real NEAR marketplace at once. Unsold work is marked down 15% after 15 minutes, on both venues."],
  ["#13243F", "Collector", "Buys, and the contract splits the money", `Anyone with a ${NET_NAME} wallet can call buy. The contract sends the token, pays the owner 30%, and adds 10/30/15/15% to the curator, painter, critic and seller budgets. Anything above a robot's budget cap is swept to the owner. Robots pay for their next AI calls and gas from these budgets, so the swarm funds itself.`],
];

export default async function How() {
  const ai = aiMode();
  const main = NETWORK === "mainnet";
  const stats = await getSwarm().then((s) => s.stats).catch(() => null);
  const sold = Number(stats?.sold ?? 0);
  const minted = Number(stats?.minted ?? 0);
  return (
    <div className="page">
      <h1 className="t">How it works</h1>
      {main && (
        <div className="card" style={{ marginTop: 14, lineHeight: 1.6 }}>
          <p><span className="pill ok">Live on NEAR Mainnet</span> Contract <a className="lnk mono" href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a>. Robots: {Object.values(ROBOT_IDS).map((id, i) => <span key={id}>{i ? ", " : ""}<a className="lnk mono" href={accountUrl(id)} target="_blank" rel="noreferrer">{id}</a></span>)}. Owner and payout: <a className="lnk mono" href={accountUrl(OWNER_ID)} target="_blank" rel="noreferrer">{OWNER_ID}</a>.</p>
          <p className="k" style={{ marginTop: 6 }}>{minted} NFTs minted on mainnet so far (e.g. <a className="lnk" href={nftUrl(1)} target="_blank" rel="noreferrer">token #1 on NearBlocks</a>); every robot transaction is in the <a className="lnk" href="/ledger">Ledger</a> with an explorer link. {sold === 0 ? "No outside sales yet. The 30/10/30/15/15 sale split is proven on testnet during development; on mainnet it is pending its first buyer." : `${sold} sale(s) so far, each split on-chain.`}</p>
        </div>
      )}
      <p className="sub">Muse Swarm is a small art business run by four AI robots. Each robot is its own NEAR account with its own budget. The owner sets the rules once, and a smart contract enforces them on every move.</p>
      <section className="sec">
        <h2>Try it in 60 seconds</h2>
        <div className="grid g3">
          {[
            ["1 · Run a cycle", <>On the <a className="lnk" href="/">Studio</a>, press <b>Free demo cycle</b> (or <b>Commission a piece</b>). Four robot transactions land on {NET_NAME} in about 30 s, and each one appears in the live activity feed with an explorer link.</>],
            ["2 · Collect the work", <>Connect a {NET_NAME} wallet through NEAR Connect (Meteor, Intear, Nightly, Ledger or NEAR CLI) and press <b>Collect</b>{NETWORK !== "mainnet" && ", or let the demo collector buy it"}. The contract transfers the NFT and splits the payment in the same tx.</>],
            ["3 · Check the receipts", <>Open <a className="lnk" href="/robots">Robots</a> for each agent&apos;s budget, earnings, keys and P&amp;L, <a className="lnk" href="/ledger">Ledger</a> for every tx, and <a className="lnk" href="/api/health">/api/health</a> for live status.</>],
          ].map(([t, p]) => <div className="card" key={String(t)}><b>{t}</b><p className="k" style={{ marginTop: 6, lineHeight: 1.5 }}>{p}</p></div>)}
        </div>
      </section>

      <div className="steps sec">
        {STEPS.map(([c, n, t, p], i) => (
          <div className="card" key={n}><div className="n" style={{ background: c }}>{i + 1}</div><div><b style={{ fontSize: 17 }}>{n}: {t}</b><p>{p}</p></div></div>
        ))}
      </div>

      <section className="sec">
        <h2>Selling beyond the website</h2>
        <div className="grid g3">
          {[
            ["Cross-listed on Mintbase", <>Every new listing is also listed on Mintbase&apos;s market contract (<a className="lnk" href={accountUrl(MARKET_ID)} target="_blank" rel="noreferrer">{MARKET_ID}</a>). When someone buys there, Mintbase calls our <code>nft_transfer_payout</code> (NEP-199) and the contract pays the same owner/robot split. {NETWORK === "mainnet" ? <>The Gallery&apos;s <b>Buy via Mintbase</b> button calls the market contract directly. On testnet the same path already sold works: <a className="lnk" href="https://testnet.nearblocks.io/txns/9xXN7jQpjGsZdDWfYSBCEDmBvCJoZ3KQUrnyTrFNh1pQ" target="_blank" rel="noreferrer">9xXN7jQp… ↗</a>.</> : <>The first market sale is on-chain: <a className="lnk" href="https://testnet.nearblocks.io/txns/9xXN7jQpjGsZdDWfYSBCEDmBvCJoZ3KQUrnyTrFNh1pQ" target="_blank" rel="noreferrer">9xXN7jQp… ↗</a>. Mintbase&apos;s testnet website is paused, so the Gallery has a <b>Buy via Mintbase</b> button that calls the market contract directly.</>}</>],
            ["A marketing plan per piece", <>The Seller, using the Curator&apos;s trend context, writes a pitch, target audience, channel, best posting time and hashtags for every piece{ai.nearAi ? " with NEAR AI" : " (labeled rule-based fallback until the NEAR AI key is added)"}. Open any work in the <a className="lnk" href="/gallery">Gallery</a> and press <b>Sales &amp; marketing</b>.</>],
            ["Drafts, never posts", "Each plan includes two X post drafts with a Copy button. The app never posts to X or any other account. A human decides what goes out. Wallets and marketplaces read the NEP-177 metadata: title, description, absolute image URL and the plan as reference JSON."],
          ].map(([t, p]) => <div className="card" key={String(t)}><b>{t}</b><p className="k" style={{ marginTop: 6, lineHeight: 1.5 }}>{p}</p></div>)}
        </div>
      </section>

      <section className="sec">
        <h2>Architecture</h2>
        <pre className="diagram" tabIndex={0} aria-label="Architecture diagram. Scroll horizontally to explore.">{`  visitor ──"Run a cycle"──▶ Next.js API (Vercel)                              ${NETWORK === "mainnet" ? "NEAR Mainnet" : "NEAR testnet"}
                                 │  one step = one robot tx                ┌───────────────────────────────┐
  Google Trends / Hacker News ─▶ │  curator ── FC key ───────────────────▶ │ ${CONTRACT_ID.padEnd(29)} │
  ${(ai.nearAi ? "NEAR AI Cloud (LLM/image/VLM)" : "fallback brains (no AI key)").padEnd(28)} ─▶ │  painter ── FC key ── pin to IPFS ────▶ │  rules · budgets · jobs       │
  Pinata IPFS ◀───────────────── │  critic  ── FC key ── score ≥ 7.0? ───▶ │  NEP-171 NFTs + NEP-297 events│
                                 │  seller  ── FC key ── floor ≤ p ≤ max ▶ │  buy() → on-chain split       │
  Mintbase market ◀── nft_on_approve (NEP-178) ─────────────────────────── │  nft_transfer_payout (NEP-199)│
  wallet (NEAR Connect) ─────────┼──────────────────── buy ──────────────▶ │  fees → treasury              │
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
            ["No public budget drain", "Running a cycle is rate-limited per visitor and paced swarm-wide from on-chain job timestamps (12 per 10 min, across every server instance). Only one job runs at a time, and a signed driver token stops two visitors driving the same job."],
            ["Nothing stranded", "AI fees go to a treasury account rather than piling up on keys that can't withdraw. The owner can withdraw any robot's budget."],
            ["Lean storage", "Each robot pays for the storage it adds. NFT metadata holds the title, a short description, the image URL and a reference to the plan JSON. The image and the plan live on IPFS."],
          ].map(([t, p]) => <div className="card" key={t}><b>{t}</b><p className="k" style={{ marginTop: 6, lineHeight: 1.5 }}>{p}</p></div>)}
        </div>
      </section>

      <section className="sec">
        <h2>Why it matters</h2>
        <div className="grid g3">
          {[
            ["Agents with accounts, not API keys", "Each AI agent is a NEAR account with a budget, a scoped key and a public track record. You can audit what it spent, what it earned and every decision it made, on-chain."],
            ["A business that pays for itself", "Sales refill the robots' budgets, and they spend that on AI, storage and gas within caps the owner set. A scheduled cron runs one cycle every two hours (up to 12 a day) with no human in the loop; on mainnet it runs through 17 Nov 2026, then stops until the owner renews it. Anyone can back a robot with fund(role)."],
            ["A template for agent teams", "Swap the art for any pipeline (research, design, moderation). The pattern is the same: one contract that holds the rules and the money, many agents with their own accounts, and a split paid on every sale."],
          ].map(([t, p]) => <div className="card" key={t}><b>{t}</b><p className="k" style={{ marginTop: 6, lineHeight: 1.5 }}>{p}</p></div>)}
        </div>
      </section>

      <section className="sec" id="real">
        <h2>What&apos;s real, and what&apos;s a fallback</h2>
        <div className="card" style={{ lineHeight: 1.6 }}>
          <p><span className="pill ok">real</span> The contract, the robot accounts and keys, and every tx, budget, mint, listing, sale and split, all on {NET_NAME}. The live trends. IPFS pinning. Wallet purchases.</p>
          <p style={{ marginTop: 8 }}><span className={`pill ${ai.nearAi ? "ok" : "listed"}`}>{ai.nearAi ? "real" : "fallback"}</span> AI brains: <b>{ai.provider}</b>. Curator: {ai.curator}. Painter: {ai.painter}. Critic: {ai.critic}. Seller (pricing + marketing): {ai.seller}.{ai.nearAi && " If a NEAR AI call fails, that one step uses the labeled local fallback and the on-chain model field says fallback-*."}{!ai.nearAi && " The code already calls NEAR AI Cloud (Qwen3.6 for briefs, FLUX.2 for images, Qwen3-VL for critique) as soon as NEAR_AI_API_KEY is set. Until then, deterministic low-poly painting and a measured critic stand in, and their fees on-chain are labeled \"fallback\"."}</p>
          {NETWORK === "mainnet" ? <p style={{ marginTop: 8 }}><span className="pill ok">mainnet</span> Real NEAR. No demo collector. Buys by our own accounts (the owner {OWNER_ID} and its sub-accounts) are labeled test and never counted as outside revenue. Development history: the full test record, including the proven sale split, is on testnet at <a className="lnk mono" href={DEV_HISTORY.explorer} target="_blank" rel="noreferrer">{DEV_HISTORY.contract}</a>.</p> : <p style={{ marginTop: 8 }}><span className="pill listed">testnet</span> All money is test NEAR. The demo collector ({COLLECTOR_ID}) is the owner&apos;s own test account and is shown separately in the P&amp;L.</p>}
        </div>
      </section>

      <section className="sec">
        <h2>Accounts</h2>
        <div className="card kv" style={{ marginTop: 0 }}>
          {[["Contract", CONTRACT_ID], ...Object.entries(ROBOT_IDS).map(([r, id]) => [r[0].toUpperCase() + r.slice(1), id]), ["Owner", OWNER_ID], ["Treasury", TREASURY_ID], ["Guardian", GUARDIAN_ID], ...(main ? [] : [["Demo collector", COLLECTOR_ID]])].map(([k, v]) => [<span key={k + "k"}>{k}</span>, <a key={k} className="lnk mono" href={accountUrl(v)} target="_blank" rel="noreferrer">{v}</a>])}
        </div>
      </section>
      <p className="foot2">Muse Swarm is a NEAR hackathon project by Sina Jalilian. Sina&apos;s other entry is Atelier One, a single-agent studio and a separate project.</p>
    </div>
  );
}
