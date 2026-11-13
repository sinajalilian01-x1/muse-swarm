# Muse Swarm: Live on NEAR Mainnet (record, 13 Nov 2026, CET)

Live app: https://muse-swarm.vercel.app (`NEXT_PUBLIC_NETWORK=mainnet`). Contract: [`swarm.hlpok1lad.tg`](https://nearblocks.io/address/swarm.hlpok1lad.tg). Root and owner/payout: [`hlpok1lad.tg`](https://nearblocks.io/address/hlpok1lad.tg). Health: https://muse-swarm.vercel.app/api/health

The nearblocks NFT token pages (`/nft-token/swarm.hlpok1lad.tg/N`) depend on NearBlocks indexing the contract, which had not happened at 06:30 CET (its NFT API still returned an empty list). The mint txs below show the standard NEP-171 `nft_mint` event in every case, so use them as the proof of each token.

## Accounts (all sub-accounts of hlpok1lad.tg)
| Account | Role | Keys | Create tx |
|---|---|---|---|
| [swarm.hlpok1lad.tg](https://nearblocks.io/address/swarm.hlpok1lad.tg) | Contract (NEP-171/177/178/199/297) | full key kept offline | [5N5CTPXx…](https://nearblocks.io/txns/5N5CTPXxC2efTyvGSkuy2KttiPoCDZTFCb6sa64cyRyb) |
| [curator.hlpok1lad.tg](https://nearblocks.io/address/curator.hlpok1lad.tg) | Curator robot | function-call key only | 6zG1jHwB… |
| [painter.hlpok1lad.tg](https://nearblocks.io/address/painter.hlpok1lad.tg) | Painter robot | function-call key only | 9J7hdniZ… |
| [critic.hlpok1lad.tg](https://nearblocks.io/address/critic.hlpok1lad.tg) | Critic robot | function-call key only | BBmCQM2C… |
| [seller.hlpok1lad.tg](https://nearblocks.io/address/seller.hlpok1lad.tg) | Seller robot | function-call key only | EVXwt8Jn… |
| [treasury.hlpok1lad.tg](https://nearblocks.io/address/treasury.hlpok1lad.tg) | Receives AI fees | — | BHzNrRbg… |
| [guardian.hlpok1lad.tg](https://nearblocks.io/address/guardian.hlpok1lad.tg) | Pause only | function-call key only | HKu3c2kt… |

The full keys of the robots and the guardian were deleted after their function-call keys were added. The root key never left the box: it is not in git, Vercel or the client.

## Contract setup
| Step | Tx |
|---|---|
| Deploy + `new` (49 tests passing; wasm 394,378 B) | [4DWzVfi3…](https://nearblocks.io/txns/4DWzVfi3DR4aGLeYp6UZs3gKMqxUGSCMQ4pvx6Lc3tW3) |
| wrap.near storage deposit | [D45auiwh…](https://nearblocks.io/txns/D45auiwhS3DQxwGVsUTAKT2QAWerPZfnUsWi7qVdpGvw) |
| `enable_approvals` (Mintbase) | [F22ebXa4…](https://nearblocks.io/txns/F22ebXa425Jzub2fqPCPmd3n6Q9FnULemjPiuA2ZJGYp) |
| `fund` robot budgets 0.4 NEAR | [FekCGnWj…](https://nearblocks.io/txns/FekCGnWjPcD1sShp1UbtoKAbQiphePvZKGrKYV1fnKGQ) |
| Gas top-up 0.07 NEAR → seller | [9ZxrDwty…](https://nearblocks.io/txns/9ZxrDwtyEJARocJapSQtRXTH1BCkPfoxMfXWJfTxvF4z) |

Mainnet rules: price floor 0.05 NEAR, max 0.5 NEAR; **per-robot daily cap 0.2 NEAR** (raised from 0.1 on 13 Nov, 06:40 CET, owner `update_rules`: [2m8Jaj18…](https://nearblocks.io/txns/2m8Jaj18LCNHyVKJxzZDtbTYwCs1oSyDPLdg3N4kEfb4)); fee cap 0.01; **budget cap 0.5** (was 0.25, so funded budgets aren't swept back to the owner on a sale); at most 12 jobs a day. Site limits: 2 free cycles per IP per hour and 3 per hour globally. Paid commissions skip the pace.

## Initial six NFTs minted and listed (NEAR AI Cloud: Qwen3.6 brief, pricing and marketing; FLUX.2 image; Qwen3-VL critic)
| # | Title | Trend | Critic | AI price | Curator | Painter | Critic (mint) | Seller (list) | Token |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Neon City Horizon | rockstar games gta vi | 8.5 | 0.175 NEAR | [CYXKJvo3](https://nearblocks.io/txns/CYXKJvo3NdRJRjzM55qupx98GnhDcGb2bRofG1FkkB76) | [AUWKAGoT](https://nearblocks.io/txns/AUWKAGoTZKXjYaHsbFE1iFSTXVrnjP7KYmFkEjG7ZAoC) | [B1J2RsSk](https://nearblocks.io/txns/B1J2RsSk6fxebaNbLcTqWDKwyw7LaPCt1CTgHnZyPqE7) | [6hiJyY62](https://nearblocks.io/txns/6hiJyY62DWexKpyyujJtFAmHkVU4Vyt3VR1tzD33zvtX) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/1) |
| 2 | Crimson Geometric Sky | 내일 날씨 | 7.8 | 0.08 NEAR | [BpGHZ6bp](https://nearblocks.io/txns/BpGHZ6bpDPxFDdpv6uCj5VfeftTnVfP73uGo7LDoGWdo) | [FPMJ6WbM](https://nearblocks.io/txns/FPMJ6WbMo4Tr4nUktK3cWZnDdcTJsfEYGW4C3m11LuYU) | [DghhugBx](https://nearblocks.io/txns/DghhugBxzXtyS6h5bv9Adv1SjcqcoQh5FUnSmDJgeBp5) | [FA5DvQQ3](https://nearblocks.io/txns/FA5DvQQ3wwQRFZi2oMXegUovmj1ifw5bCrHoZusRP4oS) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/2) |
| 3 | Shattered Storm Glass | weather tomorrow | 7.2 | 0.05 NEAR | [7koXmDrQ](https://nearblocks.io/txns/7koXmDrQHsGSs7ckY556842qH5TXgjtup1XU5pZDPWtv) | [EUoZH52C](https://nearblocks.io/txns/EUoZH52C8MC2ay3ia35vb8qP7BNcFvvM3SWSJMJDaTbn) | [2e7tSZiH](https://nearblocks.io/txns/2e7tSZiHEvwxzf8Wt7E1uJ91VFiTq4Fasf5tS5s26Ti2) | [GGkKGaXd](https://nearblocks.io/txns/GGkKGaXddiDNkAP6CMLLXTde2eWsMRsmmMroURUQS9vN) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/3) |
| 4 | Digital Bloom Rising | stock market news | 8.2 | 0.05 NEAR | [5BKVzW1E](https://nearblocks.io/txns/5BKVzW1Ep3qVW8894K8sg8t21PxXcuWuF2JzW8Zx4R4M) | [FXEDUKxG](https://nearblocks.io/txns/FXEDUKxGKcZEkekRwMfkksC9gXm2GrZkDwhuSbgJR5gA) | [J1ykVzuV](https://nearblocks.io/txns/J1ykVzuVf9rVDMsPG8BhYdNBwz2PaiXMJ8UTTt6PZaz1) | [BrYLR4V7](https://nearblocks.io/txns/BrYLR4V7YsMo5Wmoe6QUjQ2AkSkkTUEHRpFLn3WLM9vF) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/4) |
| 5 | Neon Arcade Echoes | microsoft playback | 8.7 | 0.05 NEAR | [5F7F56Te](https://nearblocks.io/txns/5F7F56TehM59Mv9A6g2yxXC8WAgKCBpKBkKvm6m2mGaC) | [8kUQtKKq](https://nearblocks.io/txns/8kUQtKKq5gop7ex8B1wcQV3UZx3sTj6HTeoZaNXPr36) | [5jKUomjq](https://nearblocks.io/txns/5jKUomjqw3X2PXZ81cKqwa2oxsnncsmxFYVnZHGqeQLW) | [5DfxRDP7](https://nearblocks.io/txns/5DfxRDP7pQ7YsuqgmNfpm6L3SAchXGZKcSKdWqP4dFci) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/5) |
| 6 | Golden Joystick Bloom | who won gamer of the year 2026 | 8.2 | 0.05 NEAR | [3E3ey2q1](https://nearblocks.io/txns/3E3ey2q1DndNbkCXGPm5tvEfH3cECcaVkAeCLdHUMzNc) | [67bwBAnx](https://nearblocks.io/txns/67bwBAnxWym2ZaXyUJBkmBg35CMixWTCLFdAWTCxrgvY) | [5ZHAqWiZ](https://nearblocks.io/txns/5ZHAqWiZPJAE4kmXgqnpnBBpNf6s1p394JmrPVhve6om) | [B6QwzxX2](https://nearblocks.io/txns/B6QwzxX2EPU6dvyE3pZdpxRvfDfmvNPT4bniKbdRCmAx) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/6) |

Job 6 ran at 06:25 CET, after the launch batch. In the same run the Seller marked down token #1 from 0.175 to 0.145 NEAR, its own markdown of a listing unsold for 15 min, on both venues: [CRfDY935…](https://nearblocks.io/txns/CRfDY935D9ui4wXek7bvgid1bqGa51UhrFsRuuAFyPx3). After that the Seller reached its 0.1 NEAR daily cap, which resets at 01:00 CET (00:00 UTC). Each listing costs the Seller about 0.0144 NEAR of cap, including the 0.01 NEAR Mintbase storage deposit, so about 6 fully listed pieces fit per day.

Job 7 (first run through the production cron handler, 06:50 CET): "Geometric Halo Fire", trend "xbox 25th anniversary", Critic 8.7, AI price 0.05 NEAR.
- Txs: curator [BsE6nH45…](https://nearblocks.io/txns/BsE6nH45hEBscMNs4HrCoDEC9EUqDcRpBrY2S9Sghocf), painter [JAqcUtgm…](https://nearblocks.io/txns/JAqcUtgmg8sZnk49F3s9UmGaXm4imCWfFQaEdW5VkoLC), critic and mint [7sGbsvFA…](https://nearblocks.io/txns/7sGbsvFANxQ9yaBYiD8x75yTWCTdDeoyB9Z49CrF3F2b), listing [89LiEb5F…](https://nearblocks.io/txns/89LiEb5F7vzfDLUCENwM7T2vdBbyKxZQtPrHuQAmXKwE).
- The Seller also marked down #2 from 0.08 to 0.065 ([ECNRr7Lq…](https://nearblocks.io/txns/ECNRr7LqijxAEKypUMZYK6wnXySxke6xngqQ6J7MsTci)) and #1 from 0.145 to 0.12 ([5kMnR5zv…](https://nearblocks.io/txns/5kMnR5zvJBioUmApCtqfJCVje8iAs6mYK3gp3hsFJcpL)).

Every token is for sale in two places:
- directly from `swarm.hlpok1lad.tg`, at https://muse-swarm.vercel.app/gallery;
- on Mintbase's mainnet market, [`simple.market.mintbase1.near`](https://nearblocks.io/address/simple.market.mintbase1.near) (NEP-178 approval). `get_listing` returns prices of 0.145, 0.08, 0.05, 0.05, 0.05 and 0.05 NEAR for tokens 1–6.

mintbase.xyz currently returns HTTP 402 for every page, on mainnet as well as testnet. The listing lives in the market contract, so wallets and other UIs that read that market can still buy it.

Job 2 was started from the live website. Jobs 1 and 3–5 ran the same engine locally because of the per-IP limit of 2 per hour. The on-chain caps apply either way.

**Sales: none so far.** Outside revenue is 0 NEAR and test revenue is 0 NEAR. We did not buy any of our own pieces. The 30/10/30/15/15 sale split is proven on testnet during development (job #33 and the commission NFT #32), with the same contract code. On mainnet it is pending its first buyer.

## Pay in any token (NEAR Intents 1Click, mainnet)
Commission panel → **Any token ▾** → pick an asset → **Pay with SOL**. The site gets a real 1Click quote (`dry:false`): for example, 0.002543 SOL ≈ $0.20 → 0.06 wNEAR, ~22 s. It shows a real deposit address with a Copy button and polls the swap status, which shows "pending deposit". Refunds go to the patron's own Intents balance (`refundType: INTENTS`). The recipient is `swarm.hlpok1lad.tg`, with `ft_transfer_call` → `ft_on_transfer`. In testing we sent no funds to any deposit address.

## Autonomy through 17 Nov 2026

**Autonomous schedule (approved by Sina, 13 Nov):** 12 Vercel Cron slots a day, one every 2 hours at :17 past even UTC hours (01:17, 03:17 … 23:17 CET, ±59 min on the Hobby plan). Each slot runs one full job (`/api/cron/cycle?slot=N`). The robots choose the trend, art, critique, price, markdowns and marketing themselves.
- **End-date guard:** the handler refuses to run from **18 Nov 2026 00:00 CET**. Nothing runs after 17 Nov without a new go-ahead.
- **Affordability check:** a job opens only if every robot can still finish it today, counting both its budget and its daily cap, so no piece is left minted but unlisted.
- **Markdown reserve:** the Seller marks a listing down only if enough of its day is left for the next listing.

Robot budgets topped up from the root with `fund(role)` on 13 Nov, 06:42 CET (0.90 NEAR total):

| Robot | Amount (NEAR) | Tx |
|---|---|---|
| Curator | 0.05 | [6Vg9qW42…](https://nearblocks.io/txns/6Vg9qW42MLadevgN7zTMmkSgeqWVj1c4ZHq77qtXbGYP) |
| Painter | 0.15 | [FQgUH136…](https://nearblocks.io/txns/FQgUH136hCb9iK8WXCSq4W9tEHeBUQ5d4aAzstDzTDbT) |
| Critic | 0.23 | [DH8dkh7Y…](https://nearblocks.io/txns/DH8dkh7YUiThr7iMkXjjrgcucpU6ZVVzUsroHYE4d6cp) |
| Seller | 0.47 | [2MDGduLY…](https://nearblocks.io/txns/2MDGduLYSo3P4YMPMfWrLxWqUnBhRWeDnWbZNpNrkEJb) |

Expected output and spend:
- **Up to 12 jobs a day.** At the measured cost the Seller uses ~0.173 NEAR of its 0.2 daily cap on 12 listings, so cap and jobs/day match. Pieces the Critic rejects stay rejected.
- **Each job costs ~0.036 NEAR** out of robot budgets: NFT and listing storage, the 0.01 NEAR Mintbase deposit, AI fees and gas. Markdowns cost ~0.011 each.
- **Through 17 Nov:** about 50 more jobs, ≈ 1.9–2.0 NEAR. The 0.9 NEAR funded today lasts about 25 jobs, to around midday on 15 Nov. After that the affordability check pauses the robots cleanly unless the owner tops up again (≈ 0.85 NEAR covers 15–17 Nov).

## NEAR spent (root hlpok1lad.tg)
- Before the launch (05:47 CET): **6.6506 NEAR**. After: **5.1356 NEAR**. That includes **+3.3353 NEAR** that arrived from `intents.near` at 05:56 CET, which Sina sent, not us.
- Moved out of the root: **4.85 NEAR**. Of that, **4.73 NEAR still sits in our accounts**:
  - swarm: 4.426 NEAR, of which ~3.94 is locked by the contract code;
  - robots, treasury and guardian: 0.307 NEAR.
- Actually consumed (gas and listing storage): **≈ 0.12 NEAR**.
- No other tokens or assets were touched.


## Final audit snapshot — 13 Nov 2026, 09:14 CET

- `get_swarm.stats`: **10 jobs, 10 minted, 0 rejected, 0 expired, 0 sold**.
- `nft_total_supply`: **10**; `get_listings`: **10**. Current prices: #1 0.10 NEAR, #2 0.055 NEAR, #3–10 0.05 NEAR.
- Job #8 **Sunlit Bay Peaks**, score 7.2, completed by Vercel cron at **07:40 CET**. A Vercel request record has user-agent `vercel-cron/1.0`, HTTP 200.
- Job #9 **Velvet Moon Bloom**, score 8.2. A visitor abandoned it after painting; the final audit resumed and completed it (no new job or sale). Mint: [2g4sFGoW…](https://nearblocks.io/txns/2g4sFGoWM7Kt1BRHbDseKGSWMwTKhV3fDweNMG6uXLSi); list: [GJWLeet9…](https://nearblocks.io/txns/GJWLeet9akFdY68sA4nweLv1TcZP8QpMrU5XaNGYpDrc).
- Job #10 **Cosmic Black Holes**, score 8.2. A real audit/demo cycle, not a cron run or sale. Curator: [H7Pn9xFa…](https://nearblocks.io/txns/H7Pn9xFaoMMwv4aUrU3CYbdYsWqq5gJqqp8DBFKrjmTJ); Painter: [64UnSWiZ…](https://nearblocks.io/txns/64UnSWiZiV2jurJCLnnrCqQy91BcmLXgnB5WJEuZj4My); mint: [HLaBHyBp…](https://nearblocks.io/txns/HLaBHyBpRGGwbZqb4WzTZ9LWbkxUpco4UvA8MBQNeQp5); list: [63bWbAaf…](https://nearblocks.io/txns/63bWbAafWSgGzJXk2qA4v77kvrLgx8XHtXpFDHoY51w9).
- Scoreboard: **20 agent→agent payments** totaling **0.03 NEAR**; **0 outside revenue**, **0 test revenue**, **0 sales**.

The ready-to-use video records job #10 and clearly labels its accelerated portion. NearBlocks gave the capture browser an anti-bot challenge; Pikespeak independently displays the same mainnet receipt and `nft_mint` log: https://pikespeak.ai/tx/HLaBHyBpRGGwbZqb4WzTZ9LWbkxUpco4UvA8MBQNeQp5 .
