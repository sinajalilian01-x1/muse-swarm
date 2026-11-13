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

Mainnet rules: price floor 0.05 NEAR, max 0.5 NEAR; per-robot daily cap 0.1 NEAR; fee cap 0.01; budget cap 0.25; at most 12 jobs a day. Site limits: 2 free cycles per IP per hour and 3 per hour globally. Paid commissions skip the pace.

## Five NFTs minted and listed (NEAR AI Cloud: Qwen3.6 brief, pricing and marketing; FLUX.2 image; Qwen3-VL critic)
| # | Title | Trend | Critic | AI price | Curator | Painter | Critic (mint) | Seller (list) | Token |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Neon City Horizon | rockstar games gta vi | 8.5 | 0.175 NEAR | [CYXKJvo3](https://nearblocks.io/txns/CYXKJvo3NdRJRjzM55qupx98GnhDcGb2bRofG1FkkB76) | [AUWKAGoT](https://nearblocks.io/txns/AUWKAGoTZKXjYaHsbFE1iFSTXVrnjP7KYmFkEjG7ZAoC) | [B1J2RsSk](https://nearblocks.io/txns/B1J2RsSk6fxebaNbLcTqWDKwyw7LaPCt1CTgHnZyPqE7) | [6hiJyY62](https://nearblocks.io/txns/6hiJyY62DWexKpyyujJtFAmHkVU4Vyt3VR1tzD33zvtX) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/1) |
| 2 | Crimson Geometric Sky | 내일 날씨 | 7.8 | 0.08 NEAR | [BpGHZ6bp](https://nearblocks.io/txns/BpGHZ6bpDPxFDdpv6uCj5VfeftTnVfP73uGo7LDoGWdo) | [FPMJ6WbM](https://nearblocks.io/txns/FPMJ6WbMo4Tr4nUktK3cWZnDdcTJsfEYGW4C3m11LuYU) | [DghhugBx](https://nearblocks.io/txns/DghhugBxzXtyS6h5bv9Adv1SjcqcoQh5FUnSmDJgeBp5) | [FA5DvQQ3](https://nearblocks.io/txns/FA5DvQQ3wwQRFZi2oMXegUovmj1ifw5bCrHoZusRP4oS) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/2) |
| 3 | Shattered Storm Glass | weather tomorrow | 7.2 | 0.05 NEAR | [7koXmDrQ](https://nearblocks.io/txns/7koXmDrQHsGSs7ckY556842qH5TXgjtup1XU5pZDPWtv) | [EUoZH52C](https://nearblocks.io/txns/EUoZH52C8MC2ay3ia35vb8qP7BNcFvvM3SWSJMJDaTbn) | [2e7tSZiH](https://nearblocks.io/txns/2e7tSZiHEvwxzf8Wt7E1uJ91VFiTq4Fasf5tS5s26Ti2) | [GGkKGaXd](https://nearblocks.io/txns/GGkKGaXddiDNkAP6CMLLXTde2eWsMRsmmMroURUQS9vN) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/3) |
| 4 | Digital Bloom Rising | stock market news | 8.2 | 0.05 NEAR | [5BKVzW1E](https://nearblocks.io/txns/5BKVzW1Ep3qVW8894K8sg8t21PxXcuWuF2JzW8Zx4R4M) | [FXEDUKxG](https://nearblocks.io/txns/FXEDUKxGKcZEkekRwMfkksC9gXm2GrZkDwhuSbgJR5gA) | [J1ykVzuV](https://nearblocks.io/txns/J1ykVzuVf9rVDMsPG8BhYdNBwz2PaiXMJ8UTTt6PZaz1) | [BrYLR4V7](https://nearblocks.io/txns/BrYLR4V7YsMo5Wmoe6QUjQ2AkSkkTUEHRpFLn3WLM9vF) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/4) |
| 5 | Neon Arcade Echoes | microsoft playback | 8.7 | 0.05 NEAR | [5F7F56Te](https://nearblocks.io/txns/5F7F56TehM59Mv9A6g2yxXC8WAgKCBpKBkKvm6m2mGaC) | [8kUQtKKq](https://nearblocks.io/txns/8kUQtKKq5gop7ex8B1wcQV3UZx3sTj6HTeoZaNXPr36) | [5jKUomjq](https://nearblocks.io/txns/5jKUomjqw3X2PXZ81cKqwa2oxsnncsmxFYVnZHGqeQLW) | [5DfxRDP7](https://nearblocks.io/txns/5DfxRDP7pQ7YsuqgmNfpm6L3SAchXGZKcSKdWqP4dFci) | [token](https://nearblocks.io/nft-token/swarm.hlpok1lad.tg/5) |

Every token is for sale in two places:
- directly from `swarm.hlpok1lad.tg`, at https://muse-swarm.vercel.app/gallery;
- on Mintbase's mainnet market, [`simple.market.mintbase1.near`](https://nearblocks.io/address/simple.market.mintbase1.near) (NEP-178 approval). `get_listing` returns prices of 0.175, 0.08, 0.05, 0.05 and 0.05 NEAR for tokens 1–5.

mintbase.xyz currently returns HTTP 402 for every page, on mainnet as well as testnet. The listing lives in the market contract, so wallets and other UIs that read that market can still buy it.

Job 2 was started from the live website. Jobs 1 and 3–5 ran the same engine locally because of the per-IP limit of 2 per hour. The on-chain caps apply either way.

**Sales: none so far.** Outside revenue is 0 NEAR and test revenue is 0 NEAR. We did not buy any of our own pieces. The 30/10/30/15/15 sale split is proven on testnet during development (job #33 and the commission NFT #32), with the same contract code. On mainnet it is pending its first buyer.

## Pay in any token (NEAR Intents 1Click, mainnet)
Commission panel → **Any token ▾** → pick an asset → **Pay with SOL**. The site gets a real 1Click quote (`dry:false`): for example, 0.002543 SOL ≈ $0.20 → 0.06 wNEAR, ~22 s. It shows a real deposit address with a Copy button and polls the swap status, which shows "pending deposit". Refunds go to the patron's own Intents balance (`refundType: INTENTS`). The recipient is `swarm.hlpok1lad.tg`, with `ft_transfer_call` → `ft_on_transfer`. In testing we sent no funds to any deposit address.

## NEAR spent (root hlpok1lad.tg)
- Before the launch (05:47 CET): **6.6506 NEAR**. After: **5.1356 NEAR**. That includes **+3.3353 NEAR** that arrived from `intents.near` at 05:56 CET, which Sina sent, not us.
- Moved out of the root: **4.85 NEAR**. Of that, **4.73 NEAR still sits in our accounts**:
  - swarm: 4.426 NEAR, of which ~3.94 is locked by the contract code;
  - robots, treasury and guardian: 0.307 NEAR.
- Actually consumed (gas and listing storage): **≈ 0.12 NEAR**.
- No other tokens or assets were touched.
