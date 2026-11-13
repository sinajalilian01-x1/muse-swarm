// Buys a listed NFT the same way the browser does (NEAR Connect -> signAndSendTransaction with
// FunctionCall "buy", 100 Tgas, deposit = price), signed by YOUR testnet account. Prints tx, new owner and the split.
// Usage: BUYER=you.testnet BUYER_KEY_FILE=~/.near-credentials/testnet/you.testnet.json node scripts/e2e/wallet-buy.mjs [token_id]
import { Account, JsonRpcProvider, KeyPairSigner, actions } from 'near-api-js';
import fs from 'fs';
const CONTRACT = process.env.CONTRACT || 'swarm.museswarm.testnet';
const { BUYER, BUYER_KEY_FILE } = process.env;
if (!BUYER || !BUYER_KEY_FILE) { console.error('Set BUYER and BUYER_KEY_FILE'); process.exit(1); }
const provider = new JsonRpcProvider({ url: 'https://rpc.testnet.fastnear.com' });
const listings = await provider.callFunction({ contractId: CONTRACT, method: 'get_listings', args: { from_index: 0, limit: 100 } });
const l = process.argv[2] ? listings.find((x) => x.token_id === process.argv[2]) : listings[listings.length - 1];
if (!l) { console.log('Nothing listed right now. Run a cycle first (node scripts/e2e/hosted-cycle.mjs <url> --no-buy).'); process.exit(1); }
const acct = new Account(BUYER, provider, KeyPairSigner.fromSecretKey(JSON.parse(fs.readFileSync(BUYER_KEY_FILE, 'utf8')).private_key));
const res = await acct.signAndSendTransaction({ receiverId: CONTRACT, actions: [actions.functionCall('buy', { token_id: l.token_id }, 100_000_000_000_000n, BigInt(l.price))], waitUntil: 'EXECUTED_OPTIMISTIC', throwOnFailure: false });
const events = (res?.receipts_outcome || []).flatMap((r) => r?.outcome?.logs || []).filter((x) => x.startsWith('EVENT_JSON:')).map((x) => JSON.parse(x.slice(11)));
const tok = await provider.callFunction({ contractId: CONTRACT, method: 'nft_token', args: { token_id: l.token_id } });
console.log(JSON.stringify({ tx: `https://testnet.nearblocks.io/txns/${res?.transaction?.hash}`, token: l.token_id, owner: tok?.owner_id, events: events.map((e) => e.event), split: events.find((e) => e.event === 'split_paid')?.data?.[0] }, null, 1));
