# Muse Swarm

**Four AI robots run a tiny art business on NEAR.** The Curator reads live trends, the Painter paints, the Critic judges, and the Seller prices and lists. Each robot is its own NEAR account and holds only function-call keys. A smart contract enforces the owner's rules on every move and splits every sale on-chain.

- Live demo (NEAR **testnet**): https://muse-swarm.vercel.app
- Contract: [`swarm.museswarm.testnet`](https://testnet.nearblocks.io/address/swarm.museswarm.testnet)
- Pages: Studio (live 3D room), [How it works](https://muse-swarm.vercel.app/how), [Gallery](https://muse-swarm.vercel.app/gallery), [Robots](https://muse-swarm.vercel.app/robots), [Ledger](https://muse-swarm.vercel.app/ledger)

> Sina Jalilian's other NEAR hackathon entry is **Atelier One** (https://atelier-one-near.vercel.app): a single AI agent that runs a studio, with a receipt-style UI. It is a separate project. Muse Swarm is about several agents with separate accounts that coordinate through one contract.

## What happens in one cycle

| # | Robot | What it does | On-chain call |
|---|-------|--------------|---------------|
| 1 | Curator | Picks a real trend (Google Trends daily RSS US/UK + Hacker News, with a safety blocklist) and writes an art brief | `curator_open_job(trend, source, brief, fee, model)` |
| 2 | Painter | Paints 800×1000 art, pins it to IPFS (Pinata) | `painter_submit(job_id, title, media, fee, model)` |
| 3 | Critic | Scores the image. The contract mints a NEP-171 NFT **only if score ≥ 7.0**; otherwise the job is rejected for good | `critic_review(job_id, score, note, fee, model)` |
| 4 | Seller | Prices from score + demand; contract enforces `floor ≤ price ≤ max_price` | `seller_list(job_id, price)` |
| 5 | Anyone | Buys with a NEAR wallet (Wallet Selector), or the demo collector buys | `buy(token_id)` (payable) |

On `buy`, the contract transfers the NFT and sends 30% to the owner. It adds 10/30/15/15% to the curator, painter, critic and seller budgets. Anything above a robot's `budget_cap` is swept to the owner. Each robot pays its AI fees, its storage and its own gas (`robot_refuel`, at most 0.5 NEAR) from its budget, so the swarm funds itself within the owner's limits.

## Architecture

```
 visitor ──"Run a real cycle"──▶ Next.js 16 API routes (Vercel)                NEAR testnet
                                │ one HTTP step = one robot tx              ┌──────────────────────────────┐
 Google Trends / HN ──────────▶ │ curator  ─ FC key ──────────────────────▶ │ swarm.museswarm.testnet      │
 NEAR AI Cloud* / fallback ───▶ │ painter  ─ FC key ─ pin to IPFS ────────▶ │  rules · budgets · jobs      │
 Pinata IPFS ◀───────────────── │ critic   ─ FC key ─ score ≥ 70? mint ───▶ │  NEP-171/177/181 NFTs        │
                                │ seller   ─ FC key ─ floor ≤ p ≤ max ────▶ │  NEP-297 events              │
 wallet (Wallet Selector) ──────┼────────────────────── buy ─────────────▶ │  buy() → split → budgets     │
                                │ guardian ─ FC key ─ pause ≤ 120 s ──────▶ │  fees → treasury account     │
 3D studio, gallery, ledger ◀── view calls + FastNear tx API ◀──────────── └──────────────────────────────┘
 * NEAR AI Cloud is used when NEAR_AI_API_KEY is set (see "Real vs fallback")
```

- `contract/`: Rust contract with near-sdk 5.30 and near-contract-standards.
- `lib/`: server logic.
  - `swarm.ts`: the step engine, driver tokens, auto-refuel and pricing.
  - `ai.ts`: NEAR AI Cloud plus the labeled fallbacks.
  - `art.ts`: the low-poly painter and the measured critic.
  - `trends.ts`, `ipfs.ts`.
  - `ledger.ts`: the chain-derived tx ledger.
  - `near.ts`: near-api-js v7.
  - `wallet.ts`: the client-side Wallet Selector.
- `components/studio/`: the approved "B low-poly" three.js room.
  - `director.js` turns real chain events into the robots' story. There are three modes:
    - **live**: you pressed the button, and each beat waits for that robot's tx.
    - **watch**: someone else's job is running, so the room follows it.
    - **replay**: nothing is running, so the room replays recent real jobs.
- `app/api/*`: `state`, `swarm/step`, `swarm/collect`, `swarm/pause`, `ledger`, `jobs`, `robots`, `media/[cid]` (a same-origin IPFS proxy so WebGL can draw the art).

## Contract

Init: `new(owner_id, treasury_id, guardian_id, curator_id, painter_id, critic_id, seller_id, rules)`

| Kind | Methods |
|------|---------|
| Owner | `update_rules`, `set_kill_switch`, `withdraw(role, amount)`, `set_robot`, `set_guardian`, `set_treasury`, `guardian_pause` (up to 1 day) |
| Anyone | `fund(role?)` (payable), `buy(token_id)` (payable) |
| Robots (FC keys) | `curator_open_job`, `painter_submit`, `critic_review`, `seller_list`, `robot_refuel` |
| Guardian (FC key) | `guardian_pause(seconds ≤ 120)`: auto-releases, so a demo visitor can't freeze the swarm |
| Views | `get_swarm`, `get_job`, `get_jobs(before, limit)`, `get_listings`, `nft_token`, `nft_tokens`, `nft_metadata`, … |

Rules on testnet:
- Price floor 0.05 NEAR and max price 0.25 NEAR.
- Mint threshold 7.0.
- Daily spend cap 0.3 NEAR per robot, and a fee cap of 0.02 NEAR per call.
- Budget cap 1 NEAR, with anything above it swept to the owner.
- 60 jobs per day.
- Sale split: owner 30, curator 10, painter 30, critic 15, seller 15 (%).

Safety:
- Only one job can be active at a time, and an abandoned job expires after 10 minutes.
- Steps must run in order.
- Only the matching robot can call each step.
- Storage is charged to the robot that adds it.
- AI fees go to a **treasury** account, so no funds get stranded on accounts that hold only function-call keys.

### Tests

```bash
npm run test:contract     # = cd contract && cargo test   → 33 passed
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
- paging.

Build the wasm: `cd contract && cargo near build non-reproducible-wasm --no-abi`

## Accounts (testnet)

| Account | Role | Keys |
|---------|------|------|
| `swarm.museswarm.testnet` | contract | deployer full key (kept off the server) |
| `curator/painter/critic/seller.museswarm.testnet` | robots | 3 function-call keys each: only their own method + `robot_refuel` on the contract. Full keys deleted |
| `guardian.museswarm.testnet` | demo pause | function-call keys for `guardian_pause` only. Full key deleted |
| `treasury.museswarm.testnet` | receives AI fees | full key (owner) |
| `sina.museswarm.testnet` | owner | full key kept offline, never on the server |
| `collector.museswarm.testnet` | demo collector | server key, buys at most 0.25 NEAR per work, rate-limited |

## Guardrails for a public demo

- **No unauthenticated budget drain.** Opening a job is rate-limited per IP (4 per 10 minutes), and only one job runs swarm-wide at a time. An HMAC "driver" token lets only the visitor who opened a job drive it. Another visitor can take over after 90 s of inactivity, so a job is never stuck. Robot keys can only call robot methods, and the contract caps every spend.
- **Kill switch.** The owner's `set_kill_switch` stops everything. The public "Pause the swarm for 45 s" button uses the guardian key, and the contract caps that pause at 120 s, so it always releases itself.
- **Honest P&L.** `/robots` shows revenue split into real wallets vs our demo collector. It also shows AI fees, storage, refuels and the gas each robot burned, and the robots' net result.
- **Low storage.** The NFT metadata stores only the IPFS CID, the title and a short description. Each robot pays for the storage it adds.

## Real vs fallback

| Part | Status |
|------|--------|
| Contract, accounts, keys, every mint/list/sale/split, budgets, kill switch | **Real, on NEAR testnet** |
| Trends | **Real**: Google Trends RSS (US/GB) and Hacker News |
| Images on IPFS | **Real**: pinned with Pinata |
| Wallet purchases | **Real**: NEAR Wallet Selector (MyNearWallet, Meteor, HERE) on testnet |
| AI brains | **NEAR AI Cloud when `NEAR_AI_API_KEY` is set**: Qwen3.6-35B for briefs, FLUX.2-klein for images, Qwen3-VL-30B for critique. Without a key, labeled fallbacks run instead: a keyword curator, a deterministic low-poly painter, and a critic that measures contrast, harmony, balance and detail. About 17% of works fall below 7.0 and are rejected. Fallback fees are recorded on-chain with `model: "fallback-*"`. |

## Run it

```bash
npm install
cp .env.example .env.local      # fill the robot FC keys, collector key, JOB_SECRET, PINATA_JWT (+ NEAR_AI_API_KEY)
npm run dev                     # http://localhost:3000
npm run cycle                   # one full real cycle from the CLI (add -- --no-buy to skip the demo purchase)
```

To set up a fresh swarm:

```bash
ROOT=<you>.testnet ROOT_KEY_FILE=/secure/root.json WASM=../contract-target/near/muse_swarm.wasm KEYS_OUT=/secure/keys.json node scripts/setup-testnet.mjs
```

This creates the accounts, then deploys and initializes the contract. It adds the function-call keys, deletes the full keys of the robots and the guardian, and funds the robots. Keys are written only to `KEYS_OUT`, never to the repo.

## Going to mainnet

1. Set `NEXT_PUBLIC_NETWORK=mainnet` and `NEXT_PUBLIC_SWARM_ROOT=<root>.near`.
2. Run the setup script against mainnet with small amounts. Tight rules are recommended: floor 0.05, daily cap 0.1, budget cap 0.5.
3. Set `owner_id` to Sina's payout account, and remove the demo collector (or don't fund it).

## Example transactions (testnet)

Job #2, "Wvu Basketball Crest" (trend: *wvu basketball*, score 7.8, sold for 0.09 NEAR):

| Step | Tx |
|------|----|
| open job | [ATqB4uv4…](https://testnet.nearblocks.io/txns/ATqB4uv4RTmNSAktkL5DvaQ9nb4MaxuDmeo5Rc2P8Wkt) |
| paint | [F9KfnWtT…](https://testnet.nearblocks.io/txns/F9KfnWtTdCk5em7PGwmi8WRnXjTqGKdM9L9vFMqeSSJ4) |
| review + mint | [9fvZumkV…](https://testnet.nearblocks.io/txns/9fvZumkVeJzkTryM19eR6zjSjvD5WcmWntEh85Ywd8KR) |
| list | [3Hkj2L3r…](https://testnet.nearblocks.io/txns/3Hkj2L3rvXRYUqSHcorZDz9mCAyrJPdQASuybpMKUSk2) |
| buy + split | [Agc1EQwu…](https://testnet.nearblocks.io/txns/Agc1EQwuHmUkqJEKhYcVfJFjYWA2nfdeVwKme5mjvQDk) |
