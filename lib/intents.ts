/** NEAR Intents (1Click API): let a patron pay for a commission in any token on any chain. 1Click swaps it to wNEAR
 * and withdraws to the swarm contract with ft_transfer_call + customRecipientMsg, which calls our ft_on_transfer and
 * opens the commission on-chain. Mainnet only (1Click has no testnet); on testnet the UI shows a live dry-run price
 * and the same on-chain path is exercised with wNEAR on wrap.testnet. */
export const ONECLICK = "https://1click.chaindefuser.com";
export const PAY_ASSETS = [
  { id: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", label: "USDC on Base", decimals: 6 },
  { id: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", label: "USDC on Solana", decimals: 6 },
  { id: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", label: "USDC on Arbitrum", decimals: 6 },
  { id: "nep141:eth.omft.near", label: "ETH on Ethereum", decimals: 18 },
  { id: "nep141:btc.omft.near", label: "BTC", decimals: 8 },
  { id: "nep141:sol.omft.near", label: "SOL", decimals: 9 },
  { id: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near", label: "USDT on Tron", decimals: 6 },
] as const;
export const WNEAR_ASSET = "nep141:wrap.near";
