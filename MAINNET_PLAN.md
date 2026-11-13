# Muse Swarm: mainnet plan (NOT executed)

Status, 13 Nov 2026: **the code is mainnet-ready behind one flag. Nothing has been deployed to mainnet and no real NEAR has been spent.** Going live needs Sina's explicit approval and his funding first.

## What is already mainnet-ready in the code

| Part | Testnet today | Mainnet behaviour (`NEXT_PUBLIC_NETWORK=mainnet`) |
|---|---|---|
| RPC, tx API, explorer | fastnear testnet, testnet.nearblocks.io | `rpc.mainnet.fastnear.com`, `tx.main.fastnear.com`, nearblocks.io (`lib/config.ts`) |
| Wallets | NEAR Connect on testnet | NEAR Connect on mainnet (same code; network from the flag) |
| wNEAR | `wrap.testnet` | `wrap.near`. The contract picks it from its own account suffix (`.near` → `wrap.near`), so the same wasm works on both |
| Mintbase market | `market-v2-beta.mintspace2.testnet` | `simple.market.mintbase1.near`. **It runs the same code (code hash `8mN2RonSM97rw21N376TFnaWne7NGYAnhzxhnwkM7P1M`) as the testnet market where we did 2 real sales.** Both markets are in the contract's `ALLOWED_MARKETS` |
| Pay in any token | 1Click **dry-run price only**, labeled "Mainnet only" | Real 1Click quote. The deposit address swaps the patron's token (USDC on Base/Solana/Arbitrum, ETH, BTC, SOL, USDT on Tron) into wNEAR and calls `ft_transfer_call` → `ft_on_transfer` on the contract via `customRecipientMsg {brief, patron}`, which opens the commission. We already tested this exact contract path on testnet with wNEAR (tx `HY8cWX7J…`, delivered in `G2d4YmFK…`) |
| Demo collector | Buys after 12 s so visitors see a sale (labeled **test**) | **Off.** The `/api/swarm/collect` route returns 403, and the checkbox and Demo buy button are hidden, unless `DEMO_COLLECTOR_MAINNET=yes` |
| Copy | "NEAR testnet · test NEAR" | "NEAR mainnet · real NEAR" (Nav badge, footers, toasts, page description) |
| Rules | floor 0.05, max 0.25 | defaults in the setup script: floor 0.5, max 5, daily cap 0.3 per robot, fee cap 0.02, budget cap 1, 24 jobs/day, same split 30/10/30/15/15 |

I verified this locally: a mainnet build (`NEXT_PUBLIC_NETWORK=mainnet NEXT_PUBLIC_SWARM_ROOT=museswarm.near next build && next start`) compiles. It shows "NEAR mainnet · real NEAR", the demo collector returns 403, and the 1Click route requires a real brief, patron and refund address.

## Accounts needed

| Account | Who creates it | Purpose | Keys |
|---|---|---|---|
| `museswarm.near` (or any `<root>.near`) | **Sina**, from his own wallet | Parent of all swarm accounts | Sina's full key (hardware wallet ideally) |
| **Owner / payout:** Sina's existing account, e.g. `sina.near` | Sina | Gets 30% of every sale and the budget-cap sweeps; can pause, set rules, withdraw | Sina only. Never on the server |
| `swarm.<root>` | setup script | The contract | Full key in `KEYS_OUT` only. Remove it, or keep it in a hardware wallet, after launch |
| `curator / painter / critic / seller.<root>` | setup script | The four agents | 3 function-call keys each (own method + `robot_refuel`). Full keys deleted by the script |
| `guardian.<root>` | setup script | Public pause, at most 120 s | 2 FC keys (`guardian_pause`). Full key deleted |
| `treasury.<root>` | setup script | Receives AI fees | full key (Sina) |
| *(no collector on mainnet)* | | | |

## Cost estimate (NEAR)

| Item | NEAR |
|---|---|
| Create `museswarm.near` from Sina's wallet (top-level name + minimum balance) | ~0.1–0.2 |
| `swarm.<root>`: 394 KB wasm locks ~3.94 NEAR of storage, plus state headroom (testnet uses 438 KB after 31 jobs, ~1.5 KB per job) | 5.5 |
| 4 robot gas wallets at 0.3 NEAR (on testnet each robot spent ~0.01 NEAR of gas in 31 jobs) | 1.2 |
| treasury 0.05 + guardian 0.1 | 0.15 |
| Robot budgets via `fund()` (AI fees, storage, Mintbase listing deposit of 0.01 per piece) | 1.0 |
| wNEAR registration for the contract (`storage_deposit`) | 0.00125 |
| Gas for ~17 setup txs | ~0.05 |
| **Total to launch** | **≈ 8.0–8.2 NEAR** |
| Running cost | ~0.02–0.03 NEAR per job (gas, IPFS-free storage, 0.01 Mintbase deposit). It is paid from robot budgets, which every sale refills |

The storage (~5 NEAR) stays locked in the contract account, not spent. Most of it comes back if the contract state is ever cleaned up.

## Exact steps (after Sina says yes and funds)

1. **Sina** creates `museswarm.near` from his wallet and funds it with ~8.5 NEAR. He decides the owner/payout account (e.g. `sina.near`).
2. On the box, keeping keys outside the repo:
   ```bash
   cd contract && cargo test && cargo near build non-reproducible-wasm --no-abi   # 48 tests
   cd .. && NETWORK=mainnet ROOT=museswarm.near OWNER_ID=sina.near node scripts/setup-network.mjs   # DRY RUN: prints every step + cost
   ```
3. Sina reviews the printed plan. Then:
   ```bash
   NETWORK=mainnet ROOT=museswarm.near OWNER_ID=sina.near ROOT_KEY_FILE=/secure/museswarm.near.json \
   KEYS_OUT=/secure/mainnet-keys.json CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL node scripts/setup-network.mjs --execute
   ```
   The script refuses to run on mainnet without both `--execute` and `CONFIRM_MAINNET=I_HAVE_SINAS_APPROVAL`. It:
   - creates the accounts and deploys and initializes the contract with the mainnet rules;
   - registers the contract on `wrap.near`;
   - adds function-call keys and deletes the robots' and guardian's full keys.
4. **Sina signs the 2 owner calls** from his own wallet (the script prints the exact NEAR CLI commands): `enable_approvals` and `fund` (1 NEAR).
5. Set up a **separate Vercel project** (e.g. `muse-swarm-mainnet`), so the testnet demo stays up for judges. Give it these env vars:
   - `NEXT_PUBLIC_NETWORK=mainnet`
   - `NEXT_PUBLIC_SWARM_ROOT=museswarm.near`
   - `NEXT_PUBLIC_OWNER_ID=sina.near`
   - `CURATOR_KEYS` / `PAINTER_KEYS` / `CRITIC_KEYS` / `SELLER_KEYS` / `GUARDIAN_KEYS`, from `KEYS_OUT`
   - `JOB_SECRET`, `PINATA_JWT`, `CRON_SECRET`
   - `NEAR_AI_API_KEY` (strongly recommended on mainnet)
   - optional `ONECLICK_JWT` (removes the 1Click fee surcharge)
   - **No `COLLECTOR_KEY`**
6. Smoke test with 1 cycle (`hosted-cycle.mjs --no-buy`). Check the listing on the Mintbase mainnet market, then make one small real buy from Sina's wallet. That buy must be labeled as an owner/test buy, which is automatic for accounts under the root.
7. Do one 1Click test commission with ~$1 USDC, and watch `/api/intents/quote?depositAddress=…` until it shows SUCCESS and the commission is delivered.

## Risks and how they are contained

- **Agent keys leak.** Each robot key can call one method on one contract. Spending is capped per day on-chain. The guardian can pause, and the owner has a kill switch.
- **Bad price.** The contract enforces the floor and max. Marketplace sales use `nft_transfer_payout`, which is accepted only from an allow-listed market. That market must also hold the approval our own Seller granted, with a listing price the contract had already checked against the floor and max. The market enforces that price.
- **Stuck commission.** The patron can cancel for a full refund after 30 minutes, and the owner can cancel at any time.
- **Contract upgrade key.** After launch, keep `swarm.<root>`'s full key offline (or delete it to make the contract immutable).
