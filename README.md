# Muse Swarm

**Four AI agents run a small art business on NEAR with no humans in the loop. Commission a piece and watch them make it for you.**
The Curator reads live trends (or your brief), the Painter paints, the Critic judges, and the Seller prices, markets and lists. Every piece is for sale on the studio site *and* on Mintbase's NEAR marketplace, and it comes with a marketing plan the Seller wrote. Each agent is its own NEAR account that holds only a function-call key. One smart contract holds the owner's rules and the money. It mints an NFT only if the Critic scores the work 7.0 or higher, and it splits every sale between the owner and the four agents' budgets. The agents then pay for their own AI, storage and gas out of those budgets.

## Live on NEAR Mainnet

- **Live app:** https://muse-swarm.vercel.app
- **Contract:** [`swarm.hlpok1lad.tg`](https://nearblocks.io/address/swarm.hlpok1lad.tg) (Rust; NEP-171/177/178/199/297)
- **Robot accounts:** [`curator.hlpok1lad.tg`](https://nearblocks.io/address/curator.hlpok1lad.tg), [`painter.hlpok1lad.tg`](https://nearblocks.io/address/painter.hlpok1lad.tg), [`critic.hlpok1lad.tg`](https://nearblocks.io/address/critic.hlpok1lad.tg), [`seller.hlpok1lad.tg`](https://nearblocks.io/address/seller.hlpok1lad.tg). Each holds only a function-call key.
- **Supporting accounts:** [`treasury.hlpok1lad.tg`](https://nearblocks.io/address/treasury.hlpok1lad.tg) (AI fees) and [`guardian.hlpok1lad.tg`](https://nearblocks.io/address/guardian.hlpok1lad.tg) (pause only). Owner and payout: [`hlpok1lad.tg`](https://nearblocks.io/address/hlpok1lad.tg).
- **A minted token:** NFT #5 "Neon Arcade Echoes":
  - mint tx (`nft_mint` event, Critic score 8.7): [5jKUomjq…](https://nearblocks.io/txns/5jKUomjqw3X2PXZ81cKqwa2oxsnncsmxFYVnZHGqeQLW);
  - listing tx (0.05 NEAR, also on Mintbase): [5DfxRDP7…](https://nearblocks.io/txns/5DfxRDP7pQ7YsuqgmNfpm6L3SAchXGZKcSKdWqP4dFci);
  - token page: [nearblocks.io/nft-token/swarm.hlpok1lad.tg/5](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/5).
- **Contract deploy:** [4DWzVfi3…](https://nearblocks.io/txns/4DWzVfi3DR4aGLeYp6UZs3gKMqxUGSCMQ4pvx6Lc3tW3). Every mainnet tx is in `MAINNET_LIVE.md` and on the [Ledger](https://muse-swarm.vercel.app/ledger).

**Status (13 Nov 2026, 09:14 CET):** 10 jobs, 10 NFTs minted and listed on NEAR Mainnet. Current prices are 0.05–0.10 NEAR after Seller markdowns (initial NEAR AI Cloud prices were 0.05–0.175 NEAR). The robots now run on their own, up to 12 jobs a day through 17 Nov 2026, so the live count on the site and the Ledger will be higher. They are for sale directly and on Mintbase's mainnet market. **There have been no outside sales so far.** The 30/10/30/15/15 sale split is proven on testnet during development; on mainnet it is pending its first buyer.

**Development history (testnet):** [`swarm.museswarm.testnet`](https://testnet.nearblocks.io/address/swarm.museswarm.testnet) holds 33 earlier jobs and every tested money path (see "Development history" below).

- **Health (network, contract, explorer links, sales status):** https://muse-swarm.vercel.app/api/health
- Built at **NEAR HACKATHON** (Nov 2026). Tracks: AI Swarms, Agent Economy, Autonomous Business, NFTs That Do Something.

## Sister project

Sina Jalilian's other NEAR HACKATHON entry is **[Retr0 Academy on NEAR](https://retr0school-near.vercel.app)** ([repository](https://github.com/sinajalilian01-x1/retr0-academy-near)).

Retr0 Academy is a retro-style coding academy where you learn NEAR and Web3, ship real code, and earn a soulbound on-chain certificate by passing a hard, server-graded exam.

Muse Swarm is a different project. It is a multi-agent swarm of four AI robots, each with its own NEAR account, that coordinate through one contract to brief, paint, judge, mint, market and sell work on NEAR Mainnet.

## Ready-to-use demo video

The submission pack includes **`muse-swarm-demo.mp4`** (88.47 s, 1920×1080, 30 fps; captions, no voiceover) and **`muse-swarm-thumbnail.png`** (1280×720). It shows a real mainnet cycle (#10), the live commission quote (no purchase), gallery/marketing, scoped keys and owner caps, and an independent explorer receipt. NearBlocks challenged automated playback, so the video uses Pikespeak for the `critic_review` / `nft_mint` proof; all NearBlocks links remain in the docs. No sales or revenue are staged. See `FINAL_AUDIT.md` for the final judge-style checks and deployment evidence.

## Try it in under 2 minutes (do X, see Y)

| Do | See |
|----|-----|
| Open https://muse-swarm.vercel.app | The header badge reads **Live on NEAR · Mainnet**. The top of the page is a live **"No humans · ran itself for N h · jobs · agent→agent payments"** scoreboard. Each chip links to the explorer. Revenue from real outside buyers and our own **test** buys are counted separately. |
| Press **Commission a piece · 0.06 NEAR**, type a brief, **Pay** with a NEAR wallet (or **Pay in wNEAR**) | This is real NEAR on mainnet. You pay first, and the contract holds the money. The robots brief, paint, judge and mint *your* piece, and the Seller delivers the NFT to your wallet (`commission_delivered`). The split is paid on-chain. A rejected piece is retried automatically. You can cancel for a full refund after 30 min. About 1–2 min. |
| Open **Any token ▾** in the commission panel and press **Pay with …** | A live **NEAR Intents 1Click** quote (e.g. 0.0025 SOL ≈ $0.20 → 0.06 wNEAR, ~22 s) and a real deposit address with swap status. The swapped wNEAR pays the contract via `ft_on_transfer`. Refunds go to your own Intents balance. |
| Or press **Free demo cycle** (mainnet: 2 per visitor per hour, 3 per hour overall) | Four robots act in the 3D studio, and four mainnet transactions (`curator_open_job` → `painter_submit` → `critic_review` → `seller_list`) appear in **Live on-chain activity**. The new NFT is then listed for sale. There is no demo collector on mainnet. |
| In the [Gallery](https://muse-swarm.vercel.app/gallery), open **Sales & marketing** on a listed work | The venues (Muse Swarm direct, the **Mintbase market contract**, any NEAR wallet) and the Seller's **marketing plan**: pitch, audience, channel and time, hashtags, and X post drafts with a Copy button. The app never posts. **Buy via Mintbase** buys through Mintbase's market, which calls our NEP-199 `nft_transfer_payout`, and the same split is paid. |
| Press **Connect wallet** and pick a NEAR wallet (Meteor, Intear, Nightly, Ledger or NEAR CLI), then press **Collect** on a listed work in [Gallery](https://muse-swarm.vercel.app/gallery) | Your wallet signs `buy(token_id)`. The NFT moves to you, and a receipt shows the split with a tx link. |
| Open [Robots](https://muse-swarm.vercel.app/robots) | Each agent's account, its scoped key (method names and allowance read live from chain), budget, daily spend against the cap, earnings, fees, storage, gas, and an honest P&L that separates outside revenue from our own test buys. |
| Press **Back the Painter with 0.1 NEAR** on Robots | Your wallet calls the public payable `fund(role)`, and the NEAR lands in that agent's on-chain budget. |
| Press **Pause the swarm for 45 s** on Robots | The guardian key calls `guardian_pause`. The robots are refused on-chain until the pause releases itself (the contract caps it at 120 s). |
| Open [Ledger](https://muse-swarm.vercel.app/ledger) | Every tx the swarm ever made, decoded, with gas burned. Look for `painter paid curator … for the brief` and `seller paid critic … for the appraisal`. |

Some works score below 7.0, roughly one in five. The contract refuses to mint those, and they stay in the Gallery marked **rejected**.

## Why it matters

- **Agents with accounts, not shared API keys.** Each agent has a NEAR account, a budget, a key scoped to one method, and a public track record. You can audit what each agent spent, earned and decided, on-chain.
- **Agents hire agents.** On every job the Painter pays the Curator for the brief and the Seller pays the Critic for the appraisal. The money moves budget to budget inside the contract (`agent_paid` events). Each agent's earnings, payments and track record (hit rate, average score, approval rate, sell-through) are on the Robots page.
- **A business that pays for itself, within limits.** Sales refill the agents' budgets, and they spend that on AI, storage and gas (`robot_refuel`). The owner's caps are enforced by the contract: price floor and max, mint threshold, daily spend cap, per-call fee cap, jobs per day, budget cap with sweeps, and a kill switch.
- **Autonomous.** Vercel Cron calls `/api/cron/cycle` 12 times a day, one slot every 2 hours, and each call runs a whole cycle with no human. On mainnet this runs through 17 Nov 2026; an end-date guard stops it from 18 Nov 00:00 CET until the owner renews it. Each listing then waits for a collector. Visitors can also start cycles.
- **It sells beyond its own website.** The Seller cross-lists every piece on Mintbase's market (NEP-178 approval + NEP-199 payout). It writes and pins a marketing plan, which is the NFT's NEP-177 `reference`, and logs it on-chain (`marketing_plan`). Proper NEP-177 metadata (description, absolute media, reference) means wallets and marketplaces show real cards.
- **Customers, not just demos.** Commissions are paid up front in NEAR or wNEAR, or in any token through NEAR Intents on mainnet. The contract escrows the payment until the Seller delivers.
- **Honest numbers.** Buys by our own accounts (`hlpok1lad.tg` and its sub-accounts on mainnet; the demo collector and `museswarm.testnet` accounts during development) are labeled "test" everywhere and never counted as outside sales. Outside revenue on mainnet so far: 0.
- **It learns from its own market.** The Seller tracks real signals for every token: gallery views, detail clicks and Collect clicks from real visitors, plus sales, markdowns and time listed read from the chain. Before each new job the Curator reads those numbers, adjusts the brief (palette, trend source, list price) and writes down why. The decision record is pinned to IPFS and its CID goes on-chain at the end of the job brief. With too little data it says so ("learning, not enough data yet") instead of guessing.
- **You can watch it think.** The home page shows a live feed of each robot's real decisions and the reasons it gave, such as the Curator's pick, the Critic's score and note, and the Seller's price and why. Every line comes from the signed transaction or the IPFS document it points to, and links to that tx.
- **The robots hire outside help.** The Critic posts one small paid bounty at a time ("write a caption for token #N, 0.02 NEAR") on [/bounty](https://muse-swarm.vercel.app/bounty). Anyone can enter with a NEAR account. At the deadline the Critic's vision model judges every entry against the artwork, pins its ranking and reasons to IPFS, and its bounty purse pays the winner with a normal NEAR transfer that is linked in the feed.
- **A pattern others can reuse.** Swap the art for research, design or moderation and the pattern still holds: one contract holds the rules and the money, many agents each have their own account, and every sale pays a split.

## How it works

```mermaid
flowchart LR
  V[Visitor or scheduled cron] -->|Run a cycle| API[Next.js API on Vercel<br/>one HTTP step = one agent tx]
  T[Google Trends + Hacker News] --> API
  AI[NEAR AI Cloud<br/>or labeled fallback] --> API
  API -->|pin| IPFS[(Pinata IPFS)]
  subgraph NEAR Mainnet
    C[swarm.hlpok1lad.tg<br/>rules · budgets · jobs<br/>NEP-171 NFTs · NEP-297 events]
    CU[curator.*] -->|curator_open_job| C
    PA[painter.*] -->|painter_submit| C
    CR[critic.*] -->|critic_review · mint if ≥ 7.0| C
    SE[seller.*] -->|seller_list · floor ≤ p ≤ max| C
    G[guardian.*] -->|guardian_pause ≤ 120 s| C
    C -->|30% owner| O[hlpok1lad.tg owner]
    C -->|AI fees| TR[treasury.*]
  end
  API -. FC keys .-> CU & PA & CR & SE
  W[Your wallet via NEAR Connect] -->|buy · fund · commission| C
  SE -->|approve + list| MB[Mintbase market<br/>NEP-178/199]
  MB -->|nft_transfer_payout · split| C
  I[NEAR Intents 1Click<br/>any token → wNEAR] -->|ft_transfer_call| C
  C -->|view calls + FastNear tx API| UI[3D studio · gallery · robots · ledger]
```

| # | Agent | What it does | On-chain call |
|---|-------|--------------|---------------|
| 1 | Curator | Picks a real trend (Google Trends daily RSS US/UK + Hacker News, safety blocklist) and writes a brief | `curator_open_job(trend, source, brief, fee, model)` |
| 2 | Painter | Paints the work, pins it to IPFS, and **pays the Curator 0.002 NEAR for the brief** | `painter_submit(job_id, title, media, fee, model)` |
| 3 | Critic | Scores the image. The contract mints a NEP-171 NFT **only if score ≥ 7.0** | `critic_review(job_id, score, note, fee, model)` |
| 4 | Seller | Prices from score + recent demand and **pays the Critic 0.001 NEAR for the appraisal**. The contract enforces `floor ≤ price ≤ max_price`. Writes the **marketing plan** and **cross-lists on Mintbase** in the same tx. If a work sits unsold for 15 min, the Seller marks it down 15% everywhere. A commissioned piece is **delivered** to the patron instead | `seller_list(job_id, price, plan, market)` |
| 5 | Anyone | Buys with a wallet or on Mintbase (the testnet build also had a demo collector, labeled test) | `buy(token_id)` (payable) · Mintbase `buy` → `nft_transfer_payout` |
| 6 | Patron | Commissions a piece with a brief | `commission(brief)` (payable) · wNEAR/Intents: `ft_transfer_call` → `ft_on_transfer` |

On `buy`, the contract transfers the NFT, pays 30% to the owner, and adds 10/30/15/15% to the curator, painter, critic and seller budgets. It sweeps anything above a robot's `budget_cap` to the owner and emits `nft_transfer`, `sold` and `split_paid`.

### The swarm learns from its market (feedback loop)

1. **Signals.** The Gallery sends a *view* when a listed or sold work stays at least half on screen for 1 s (once per browser session). Opening a work's details or links counts as a *click*, and pressing Collect counts as a *collect*. `/api/signal` ignores bots and headless browsers (so our own QA never counts), rate-limits each IP and counts one signal per visitor, token and kind every 30 minutes. Sales, markdowns (`repriced` events), first list price and time listed come from the chain.
2. **Storage without a database.** The app keeps everything on NEAR or IPFS. Each server instance batches counts in memory and pins a small delta JSON to Pinata at most every 45 s. Readers add the latest snapshot to the newer deltas, and when deltas pile up they are compacted into a new snapshot.
3. **Lessons** (`lib/learn.ts`, `GET /api/learned`):
   - **Style and trend source.** These lessons need at least 20 real views overall and 8 views per group. A palette or trend source that gets 1.5x or more the weighted engagement per view becomes the preference, for example "Night Market pieces got 2.4x the engagement per view, so leaning Night Market."
   - **Price.** If nothing sold in 24 h and listings are a day or more old, the next list price drops 10%, never below the owner's floor. A sale in the last 24 h raises it 10%, never above the max.
   - Until then the panel reads "Learning, not enough data yet", with the real view count.
4. **Decision on-chain.** Before `curator_open_job`, the Curator gets the lessons in its NEAR AI prompt (or the fallback curator applies the preferred palette) and returns a `why`. The full decision is pinned as `muse-swarm-decision-<job>.json`. It contains the lessons, per-token stats, the SHA-256 of the stats and the Curator's choice and reason. The brief ends with `[L:<CID>]`, so the reasoning is fixed on-chain with the job. The Seller gets the price lesson too, and its price, reason and the lesson it used go into the token's NEP-177 reference JSON (`pricing`).
5. **Panel.** "What the swarm learned" on the home page shows the status, the lessons, the totals and the per-token stats.

### Live reasoning feed

`GET /api/feed` rebuilds the robots' thinking from the last 40 contract transactions (FastNear tx API):
- **Curator:** the trend it picked, the title, the palette and its `why` from the decision CID.
- **Painter:** the title and the model it used.
- **Critic:** minted or rejected, the score out of 10 and its own note.
- **Seller:** the list price, the AI's pricing reason, the audience and any markdowns (old → new price).
- **Sales:** each sale, with test buys labeled as test.

Each item links to its tx and job, shows the model, and links to the IPFS "why" document where there is one. Nothing is generated for display.

### Robots hire outside help (bounties)

The swarm can pay people, not just other robots. One bounty is open at a time, for example *write a caption for "Cosmic Black Holes" (token #10), 0.02 NEAR*.

1. **Post.** When the purse can pay, the cron opens a bounty for the newest unsold listed work. The terms (task, deadline, payout, payer) are pinned to IPFS, and the Critic announces it in the reasoning feed.
2. **Enter.** `POST /api/bounty` takes a NEAR account and a caption of 3–140 characters, with no links. It is limited to one entry per account, two per visitor and three per IP per 10 minutes, 60 entries per bounty, and no bots. The account must exist on-chain. Each entry is pinned to IPFS and the entrant gets its CID.
3. **Judge.** At the deadline (on the next cron slot or the next page view) the Critic's NEAR AI vision model sees the artwork and every caption. The captions are given as untrusted data, and the model is told to disqualify spam and attempts to instruct it. It returns a winner, a top 3 and a reason. That judgement is pinned to IPFS. If the model is unavailable it retries later and never guesses. With no entries or no acceptable caption, nobody is paid.
4. **Pay.** Robot accounts only hold function-call keys, so they cannot send NEAR. The payout comes from `bounty.hlpok1lad.tg`, the Critic's bounty purse. The owner fills it from the Critic's own contract budget (`withdraw("critic")`, on-chain), and only ever with one 0.02 NEAR payout plus gas, so its server-side key can never lose more than that and it cannot pay twice. Before a transfer the server checks:
   - the payout is a hard 0.02 NEAR;
   - the Critic's on-chain spend today plus bounty payouts today stays within the contract's 0.2 NEAR daily cap;
   - no kill switch or pause is on, and the autonomous window is still open;
   - the purse's own chain history shows no earlier payment, so a crash between paying and recording never pays twice.

   The transfer tx and the guard values are pinned to IPFS and linked in the feed.

No contract change was needed. Bounty files on IPFS are tagged `{app, kind, net, bounty}` and are never unpinned.

### Night mode

A sun/moon toggle in the nav switches the site to the "Aurora" night theme. The page turns true black, with faint twinkling stars and soft teal and mint aurora ribbons drifting across the top (canvas 2D, `components/Aurora.tsx`). Panels become near-black glass, and the brand accents stay the same.

The aurora is drawn small and scaled up, so the blur costs nothing. It runs at 30 fps on phones, pauses when the tab is hidden, and is a single still frame under reduced motion. In a test with 4× CPU throttling at 390 px it held 60 fps on the page. It follows the system setting by default and remembers your choice. In the 3D studio it's evening: warm lamp pools, a dusk tint on the balcony glass, cooler fill light and a softer floor bounce. The models and layout are the same, and the light fades over about a second.

## NEAR features used

- **Named sub-accounts per agent:** `curator/painter/critic/seller/guardian/treasury.hlpok1lad.tg` on mainnet.
- **Function-call access keys:** each robot key can call only its own method plus `robot_refuel`. Full keys of robots and guardian were deleted. The [Robots](https://muse-swarm.vercel.app/robots) page reads them live from RPC.
- **Smart contract (Rust, near-sdk 5):** rules, budgets, spend caps, job state machine, kill switch, guardian pause, on-chain revenue split. Tests: `cargo test` gives **49 passed**.
- **NEP-171 / 177 / 178 / 181 / 199 NFTs** minted by the contract itself, with the Critic's score as the gate. NEP-178 approvals and NEP-199 payouts let **Mintbase's market** sell them with the swarm's split.
- **NEP-141 wNEAR** (`ft_on_transfer`) and **NEAR Intents 1Click** for "pay in any token" commissions.
- **NEP-297 events** (`job_opened`, `painted`, `listed`, `agent_paid`, `repriced`, `sold`, `split_paid`, `refueled`, `funded`, `paused`, … plus standard `nft_mint`/`nft_transfer`), which drive the 3D studio's story.
- **NEAR Connect** (`@hot-labs/near-connect`), the connector NEAR recommends in place of the deprecated Wallet Selector, for buying and funding.
- **NEAR AI Cloud** (OpenAI-compatible), **live in production**:
  - Qwen3.6-35B: the Curator's brief, plus the Seller's pricing and marketing plan;
  - FLUX.2-klein: the Painter's image;
  - Qwen3-VL-30B: the Critic's review of the actual image.
  
  Each on-chain step records the `model` it used.
- **FastNear** RPC and tx API for the ledger and live feed.

## Real vs fallback

| Part | Status |
|------|--------|
| Contract, accounts, keys, every mint and listing, budgets, caps, kill switch, pause | **Real, NEAR Mainnet** (`swarm.hlpok1lad.tg`) |
| Sale split (30/10/30/15/15) | **Proven on testnet** during development (direct, Mintbase and commission sales). On mainnet it is pending its first buyer |
| Trends | **Real:** Google Trends RSS (US/GB) + Hacker News |
| Images | **Real:** pinned on IPFS (Pinata) |
| Wallet purchases and patron funding | **Real:** NEAR Connect on mainnet. Browser purchases were tested on testnet |
| Commissions (NEAR and wNEAR) | **Open on mainnet**, with no mainnet commission yet. Delivered end to end on testnet |
| Mintbase marketplace listing and sales | **Real:** every mainnet NFT is listed on Mintbase's market contract `simple.market.mintbase1.near`. The mintbase.xyz website currently returns HTTP 402, so the Gallery's **Buy via Mintbase** calls the market contract directly. A Mintbase sale was tested on testnet (`market-v2-beta.mintspace2.testnet`) |
| Pay in any token (NEAR Intents 1Click) | **Live on mainnet:** a real deposit address with status polling. No outside deposit has arrived yet |
| Marketing plans | **Real:** written per piece, pinned to IPFS, logged on-chain. Written by NEAR AI when the key is set, otherwise by a labeled `fallback-marketer`. X posts are **drafts only, never posted** |
| Market signals (views, clicks, Collect clicks) | **Real visitors only:** bots/headless browsers ignored, one per visitor per token per kind per 30 min, stored as JSON on IPFS (Pinata). Sales and markdowns are read from the chain. No seeded or simulated data: with too little data the panel says "learning" |
| Curator decisions | **Real:** the lessons + the model's `why` are pinned to IPFS, and the CID is written on-chain in the job brief (`[L:<CID>]`) |
| Reasoning feed | **Real:** rebuilt from signed tx arguments and the IPFS docs they reference |
| Bounties | **Real:** entries, the Critic's judgement and the payout record are JSON on IPFS, and the payout is a real NEAR transfer from `bounty.hlpok1lad.tg`. The flow (open, enter, judge, pay, double-pay refused) was tested end to end on testnet. On mainnet the first bounty is open and has no winner yet |
| Sales numbers | 0 outside sales on mainnet so far. Our own and test buys are labeled **test** and never counted as outside sales |
| Autonomous cycles | **Real:** Vercel Cron → `/api/cron/cycle`, 12 slots a day, mainnet through 17 Nov 2026 (end-date guard) |
| AI brains | **Real: NEAR AI Cloud, live.** Curator brief (Qwen3.6), Painter image (FLUX.2-klein), Critic review of the image (Qwen3-VL), Seller price + marketing plan (Qwen3.6). The home scoreboard shows "NEAR AI Cloud brains", and `/api/health` shows the models. If a single NEAR AI call fails, that step uses a labeled local fallback, and the on-chain `model` field then says `fallback-*`. |

## Guardrails for a public demo

- **No budget drain.** On mainnet, free cycles are limited to 2 per visitor IP per hour and paced swarm-wide to 3 per hour from on-chain job timestamps (the testnet build allowed 4 per IP and 12 overall per 10 min), which holds across every serverless instance with no extra database. Only one job runs at a time (enforced by the contract), and jobs per day plus daily spend per robot are capped on-chain.
- **Driver tokens.** An HMAC token lets only the visitor who opened a job drive it. Anyone can take over after 90 s of inactivity and is handed the token, so a job never gets stuck.
- **Kill switch + guardian.** The owner's `set_kill_switch` stops everything. The public pause button uses the guardian key, capped at 120 s by the contract.
- **Honest P&L.** Revenue from our own accounts is shown apart from outside revenue. On mainnet there is no demo collector.
- **No secrets in the client.** Robot, guardian and collector keys live only in server env vars. The client bundle and git history were scanned for every secret value (0 hits).

## Contract

Init: `new(owner_id, treasury_id, guardian_id, curator_id, painter_id, critic_id, seller_id, rules)`

| Kind | Methods |
|------|---------|
| Owner | `update_rules`, `set_kill_switch`, `withdraw(role, amount)`, `set_robot`, `set_guardian`, `set_treasury`, `guardian_pause` (up to 1 day) |
| Anyone | `fund(role?)` (payable), `buy(token_id)` (payable), `commission(brief)` (payable), `cancel_commission(id)` (patron after 30 min) |
| Markets / tokens | `nft_approve`-style approvals (Seller-granted to allow-listed markets only), `nft_transfer_payout` (NEP-199, allow-listed markets only), `nft_payout`, `nft_is_approved`, `ft_on_transfer` (wNEAR only) |
| Owner (v3+) | `enable_approvals`, `patch_metadata(token_ids)` |
| Robots (FC keys) | `curator_open_job`, `painter_submit`, `critic_review`, `seller_list`, `robot_refuel` |
| Guardian (FC key) | `guardian_pause(seconds ≤ 120)`: auto-releases, so a demo visitor can't freeze the swarm |
| Views | `get_swarm`, `get_job`, `get_jobs(before, limit)`, `get_listings`, `get_commission`, `get_commissions`, `nft_token`, `nft_tokens`, `nft_metadata`, … |

Rules on mainnet:
- Price floor 0.05 NEAR and max price 0.5 NEAR.
- Mint threshold 7.0.
- Daily spend cap 0.2 NEAR per robot (raised from 0.1 on 13 Nov with the owner's `update_rules`), and a fee cap of 0.01 NEAR per call.
- Budget cap 0.5 NEAR, with anything above it swept to the owner.
- 12 jobs per day.
- Sale split: owner 30, curator 10, painter 30, critic 15, seller 15 (%).

The testnet development build used looser limits: max price 0.25, a daily cap of 0.6, a fee cap of 0.02, a budget cap of 1 and 120 jobs per day.

Safety:
- Only one job can be active at a time, and an abandoned job expires after 10 minutes.
- Steps must run in order.
- Only the matching robot can call each step.
- Storage is charged to the robot that adds it.
- Agent-to-agent fees count against the payer's daily cap, and the payee's budget cap still sweeps any surplus to the owner.
- AI fees go to a **treasury** account, so no funds get stranded on accounts that hold only function-call keys.

### Tests

```bash
npm run test:contract     # = cd contract && cargo test   → 49 passed
```

The tests cover:
- split math and remainders;
- the price floor and max price;
- the score gate and rejection;
- the daily cap, including its reset;
- the fee cap and the job cap;
- budget-cap sweeps;
- the kill switch, and the guardian pause with its auto-release;
- robot-only and owner-only access;
- the job lock and its expiry;
- stage order;
- paging;
- agent-to-agent payments (brief and appraisal fees);
- Seller re-pricing: only after 15 minutes, only by the Seller, within floor and max, and the work sells at the new price;
- (v3) marketing plans and cross-listing: approvals only to allow-listed markets, `nft_transfer_payout` only from an approved market, the payout split, and NEP-177 metadata patching;
- (v4) commissions: the floor and max, delivery to the patron with the split, rejection retries and the attempt limit, cancel/refund timing, wNEAR-only `ft_on_transfer`.

Build the wasm: `cd contract && cargo near build non-reproducible-wasm --no-abi`

## Accounts (NEAR Mainnet)

| Account | Role | Keys |
|---------|------|------|
| [`swarm.hlpok1lad.tg`](https://nearblocks.io/address/swarm.hlpok1lad.tg) | contract | deployer full key kept offline, never on the server |
| [`curator`](https://nearblocks.io/address/curator.hlpok1lad.tg) / [`painter`](https://nearblocks.io/address/painter.hlpok1lad.tg) / [`critic`](https://nearblocks.io/address/critic.hlpok1lad.tg) / [`seller`](https://nearblocks.io/address/seller.hlpok1lad.tg)`.hlpok1lad.tg` | robots | function-call keys only: their own method + `robot_refuel`. Full keys deleted |
| [`guardian.hlpok1lad.tg`](https://nearblocks.io/address/guardian.hlpok1lad.tg) | demo pause | function-call key for `guardian_pause` only. Full key deleted |
| [`bounty.hlpok1lad.tg`](https://nearblocks.io/address/bounty.hlpok1lad.tg) | Critic's bounty purse | full key on the server, but it only ever holds one 0.02 NEAR payout plus gas, filled from the Critic's budget by the owner |
| [`treasury.hlpok1lad.tg`](https://nearblocks.io/address/treasury.hlpok1lad.tg) | receives AI fees | owner-controlled |
| [`hlpok1lad.tg`](https://nearblocks.io/address/hlpok1lad.tg) | owner and payout | Sina's wallet; key never leaves his machine and the build box |

## Development history (testnet)

Everything below was built and tested on NEAR testnet before the mainnet launch. It is kept as a record, and it is the evidence for the sale split, the Mintbase sale and commission delivery.

### Accounts (testnet)

| Account | Role | Keys |
|---------|------|------|
| `swarm.museswarm.testnet` | contract | deployer full key (kept off the server) |
| `curator/painter/critic/seller.museswarm.testnet` | robots | 3 function-call keys each: only their own method + `robot_refuel` on the contract. Full keys deleted |
| `guardian.museswarm.testnet` | demo pause | function-call keys for `guardian_pause` only. Full key deleted |
| `treasury.museswarm.testnet` | receives AI fees | full key (owner) |
| `sina.museswarm.testnet` | owner | full key kept offline, never on the server |
| `collector.museswarm.testnet` | demo collector | server key, buys at most 0.25 NEAR per work, rate-limited |

### Example transactions (testnet)

**v3/v4: selling beyond the website, and commissions** (deployed in place, state intact):
- Seller lists, writes the marketing plan and cross-lists on Mintbase in one tx: [4GB6avkj…](https://testnet.nearblocks.io/txns/4GB6avkjWArBsbR9SFqVAFKK9jhJZ9q1APiVphWUDa8r) (job #31: `listed`, `marketing_plan`, `cross_listed`).
- Sale **through Mintbase's market** (NEP-199 payout, split paid): [9xXN7jQp…](https://testnet.nearblocks.io/txns/9xXN7jQpjGsZdDWfYSBCEDmBvCJoZ3KQUrnyTrFNh1pQ). The same path from a real wallet in the browser (NEAR Connect → NEAR CLI wallet): [GTPvyFNy…](https://testnet.nearblocks.io/txns/GTPvyFNyD4qenmvzYBwSKU3GDCYz5Tw1k2HioJWP5Mb3).
- Commission paid in **wNEAR** (the NEAR Intents delivery path, `ft_on_transfer`): [HY8cWX7J…](https://testnet.nearblocks.io/txns/HY8cWX7J8bbY9PQ8XeLYHrDsxKhxajAbP3WhWXz6e7ik). Delivered to the patron with the split: [G2d4YmFK…](https://testnet.nearblocks.io/txns/G2d4YmFKd82ZUDwedg3Xb2Coa8D9MbzsCRuG65DUgj8Z).
- Commission paid in NEAR from a browser wallet: [46zD4aGp…](https://testnet.nearblocks.io/txns/46zD4aGpbax1ZMYfSaJB6uU4uM9zCVh2NgV7MaMnqkAe). Delivered after one Critic rejection and a retry: [AtZKm1CJ…](https://testnet.nearblocks.io/txns/AtZKm1CJ2ve5gWZqSLUEZ7DKssXUibiCDYkvaDjucMhZ).

All buyers above are our own test wallets, and the app labels them "test".

**Contract v2 (agents pay agents, Seller re-pricing)** was deployed in place, with state intact: [E3zatJd2…](https://testnet.nearblocks.io/txns/E3zatJd2LEtx2NqDSBAYYLNk9FM2weFnxA9Hv2web6Lm). Job #13 on v2:
- Painter pays the Curator in [Hhha5d4t…](https://testnet.nearblocks.io/txns/Hhha5d4t7UMSZPhgGMNRKWV8nutd2DhgpNDZhWKhGYT6).
- Seller lists and pays the Critic in [ApoAQMKA…](https://testnet.nearblocks.io/txns/ApoAQMKATRr614PuSx9iV3svPSAxBEqXSd3XXaR2bJ3w).
- Seller marks down a stale listing in [3ELptyuW…](https://testnet.nearblocks.io/txns/3ELptyuWiEEG3whpr4qtdHQTMyP8HZDqgtGb4rWj5Jg9).
- Demo buy + split in [7fakyfEL…](https://testnet.nearblocks.io/txns/7fakyfELMqxQhbBhsXWxvjVo8Q8ycLxVLstYqUxPFo17).

**Job #10, a fully autonomous cycle started by the daily cron and bought by a human wallet through NEAR Connect:**

| Step | Tx |
|------|----|
| open job (curator) | [4JWUoCHK…](https://testnet.nearblocks.io/txns/4JWUoCHKe9UtN9HAcHgGPYTtaCwE1K8ydczfd1zjD8G8) |
| paint + pin (painter) | [7WwjzpXs…](https://testnet.nearblocks.io/txns/7WwjzpXsx1qL97D7tSDAPHxC5X9CchRsB8Qm6k6wwQo7) |
| review + mint (critic) | [3iLiohCN…](https://testnet.nearblocks.io/txns/3iLiohCN5v2UpBiz3sqg8KYGtPGPmLnZ6rtkECcZCjmD) |
| list (seller) | [BWBD2btp…](https://testnet.nearblocks.io/txns/BWBD2btpcHn8DanhBvXUCPe7W9d6dXFmSvF3JPGLH1h5) |
| buy + split (`visitor.museswarm.testnet` via NEAR Connect) | [dFvczi7o…](https://testnet.nearblocks.io/txns/dFvczi7okd8ZezNLkz7ScHdhWk4Hop5TCtLRqxjfrcU) |

Other proofs:
- Patron `fund(painter)` via NEAR Connect: [8SEgYPZP…](https://testnet.nearblocks.io/txns/8SEgYPZPvR6xRq1cjJh4ZvAN95gz4hpqWNfKYpPc538x).
- Demo-collector buy + split (job #4): [E3z9tQf5…](https://testnet.nearblocks.io/txns/E3z9tQf5dJUp12DxjxPUgRwgJc9YqAyBRC7LRQDgVu8L).
- First sale (job #2): [Agc1EQwu…](https://testnet.nearblocks.io/txns/Agc1EQwuHmUkqJEKhYcVfJFjYWA2nfdeVwKme5mjvQDk).

## Run it

```bash
npm install
cp .env.example .env.local      # robot FC keys, guardian + collector keys, JOB_SECRET, PINATA_JWT, CRON_SECRET (+ NEAR_AI_API_KEY)
npm run dev                     # http://localhost:3000
npm run test:contract           # 49 contract tests
npm run smoke -- <testnet deployment URL>   # one full cycle against a hosted testnet build (+ demo buy)
BUYER=you.testnet BUYER_KEY_FILE=~/.near-credentials/testnet/you.testnet.json node scripts/e2e/wallet-buy.mjs   # buy as yourself (testnet build)
npm run cycle                   # one full cycle from the CLI with your own keys
```

To set up a fresh swarm (testnet shown; mainnet adds `NETWORK=mainnet` and `CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL`, see `MAINNET_PLAN.md`):

```bash
ROOT=<you>.testnet ROOT_KEY_FILE=/secure/root.json KEYS_OUT=/secure/keys.json node scripts/setup-network.mjs            # dry run: prints every step + NEAR cost
ROOT=<you>.testnet ROOT_KEY_FILE=/secure/root.json KEYS_OUT=/secure/keys.json node scripts/setup-network.mjs --execute
```

This creates the accounts, deploys and initializes the contract, adds function-call keys, deletes the robots' and guardian's full keys, and funds the robots. Keys are written only to `KEYS_OUT`, never to the repo. To build the wasm, run `cd contract && cargo near build non-reproducible-wasm --no-abi`.

## Code map

- `contract/`: the Rust contract and its 49 unit tests.
- `lib/swarm.ts`: the step engine (one HTTP step = one agent tx), driver tokens, auto-refuel and pricing.
- `lib/ai.ts`: NEAR AI Cloud plus the labeled fallbacks. `lib/art.ts`: the low-poly painter and the measured critic.
- `lib/trends.ts`, `lib/ipfs.ts`, `lib/ledger.ts` (chain-derived tx ledger), `lib/near.ts` (near-api-js v7).
- `lib/wallet.ts`: NEAR Connect buy, fund, commission (NEAR and wNEAR), buy via Mintbase.
- `lib/marketing.ts`: the Seller's marketing plan and the NEP-177 reference JSON. `lib/intents.ts`: NEAR Intents 1Click assets.
- `lib/ratelimit.ts`: the per-IP limit and the on-chain swarm-wide pace.
- `lib/signals.ts` (visitor signals on IPFS), `lib/learn.ts` (lessons + price factor), `lib/reasoning.ts` (the live reasoning feed), `lib/track.ts` (client beacons).
- `components/Reasoning.tsx` (the feed and the "What the swarm learned" panel), `components/ThemeToggle.tsx` + `components/Aurora.tsx` (night mode).
- `lib/bounty.ts` (bounties: entries, the Critic's judgement, the guarded payout), `components/Bounty.tsx`, `scripts/bounty-purse.mjs` (fill the purse from the Critic's budget).
- `components/studio/`: the three.js low-poly studio. `director.js` turns real chain events into the robots' story, in live, watch or replay mode.
- `app/api/*`: `state`, `health`, `swarm/step`, `swarm/collect`, `swarm/pause`, `cron/cycle`, `ledger`, `jobs`, `robots`, `market` (where each piece is for sale + its plan), `scoreboard`, `commission`, `intents/quote`, `media/[cid]` (a same-origin IPFS proxy for WebGL), `signal` (market signals), `learned` (what the swarm learned), `feed` (robot reasoning), `bounty` (open bounty, results, entries) and `bounty/tick` (cron-only judge and pay).

## Mainnet launch notes (13 Nov 2026, 05:47 CET)

The site runs on mainnet behind `NEXT_PUBLIC_NETWORK=mainnet`, with these parts:
- wrap.near;
- the Mintbase mainnet market `simple.market.mintbase1.near`;
- real NEAR Intents 1Click deposit addresses;
- the demo collector off;
- network-aware copy.

`scripts/setup-network.mjs --execute` with `CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL` did these steps:
- created the 7 sub-accounts of `hlpok1lad.tg`;
- deployed the contract after 49 tests passed;
- added function-call keys and deleted the robots' and guardian's full keys;
- funded the robot budgets with 0.4 NEAR.

On mainnet the robots prepay 30 Tgas (the Seller 70 Tgas), so a robot account holding 0.05 NEAR can pay its own gas.

The robots minted and listed 10 NFTs by 13 Nov 2026, 09:14 CET (current prices 0.05–0.10 NEAR after Seller markdowns). They now run autonomously, up to 12 jobs a day through 17 Nov 2026, both directly and on Mintbase. **No sales yet, and we bought nothing ourselves.** At initial launch, deployment and funding cost ≈ 4.85 NEAR from the root (historical snapshot; see live budget balances). ≈ 4.73 NEAR of that is still in our accounts (3.94 is locked by contract storage), and ≈ 0.12 NEAR went on gas and listing storage. All accounts and txs are in `MAINNET_LIVE.md`, and the plan and costs are in `MAINNET_PLAN.md`.

## License

MIT. See `LICENSE`.
