export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "testnet") as "testnet" | "mainnet";
const ROOT = process.env.NEXT_PUBLIC_SWARM_ROOT || "museswarm.testnet";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || `swarm.${ROOT}`;
export const ROBOT_IDS = {
  curator: process.env.NEXT_PUBLIC_CURATOR_ID || `curator.${ROOT}`,
  painter: process.env.NEXT_PUBLIC_PAINTER_ID || `painter.${ROOT}`,
  critic: process.env.NEXT_PUBLIC_CRITIC_ID || `critic.${ROOT}`,
  seller: process.env.NEXT_PUBLIC_SELLER_ID || `seller.${ROOT}`,
} as const;
export type Role = keyof typeof ROBOT_IDS;
export const ROLES: Role[] = ["curator", "painter", "critic", "seller"];
export const OWNER_ID = process.env.NEXT_PUBLIC_OWNER_ID || `sina.${ROOT}`;
export const TREASURY_ID = process.env.NEXT_PUBLIC_TREASURY_ID || `treasury.${ROOT}`;
export const GUARDIAN_ID = process.env.NEXT_PUBLIC_GUARDIAN_ID || `guardian.${ROOT}`;
export const COLLECTOR_ID = process.env.NEXT_PUBLIC_COLLECTOR_ID || `collector.${ROOT}`;
export const RPC_URLS = NETWORK === "mainnet"
  ? ["https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"]
  : ["https://rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];
export const TX_API = NETWORK === "mainnet" ? "https://tx.main.fastnear.com" : "https://tx.test.fastnear.com";
export const EXPLORER = NETWORK === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
export const txUrl = (h: string) => `${EXPLORER}/txns/${h}`;
export const accountUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
/** Same-origin image proxy so WebGL can paint IPFS images onto the 3D easel. */
export const mediaUrl = (cid?: string | null) => (!cid ? "" : /^(https?:|data:)/.test(cid) ? cid : `/api/media/${cid.replace(/^ipfs:\/\//, "")}`);
export const ipfsUrl = (cid: string) => IPFS_GATEWAY + cid;
/** The demo collector never pays more than this for one work (yoctoNEAR). */
export const DEMO_COLLECTOR_MAX = 250_000_000_000_000_000_000_000n; // 0.25 NEAR
export const YOCTO = 10n ** 24n;
export function toNear(y: string | bigint | number | undefined | null, digits = 4): string {
  const v = typeof y === "bigint" ? y : BigInt(String(y ?? "0").split(".")[0] || "0");
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / YOCTO;
  const frac = (a % YOCTO).toString().padStart(24, "0").slice(0, digits);
  return `${neg ? "-" : ""}${whole}${digits ? "." + frac : ""}`;
}
export const nearNum = (y: string | bigint | undefined | null) => Number(toNear(y ?? "0", 6));
export function nearToYocto(n: number | string): string {
  const [w, f = ""] = String(n).split(".");
  return (BigInt(w || "0") * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
}
export const ROBOT_META: Record<Role, { name: string; color: string; job: string; methods: string[] }> = {
  curator: { name: "Curator", color: "#16A39C", job: "Reads live trends and writes the art brief", methods: ["curator_open_job", "robot_refuel"] },
  painter: { name: "Painter", color: "#F47A38", job: "Paints the brief and pins it to IPFS", methods: ["painter_submit", "robot_refuel"] },
  critic: { name: "Critic", color: "#E9AE1C", job: "Scores the work. Only 7.0+ gets minted", methods: ["critic_review", "robot_refuel"] },
  seller: { name: "Seller", color: "#E86A8C", job: "Prices and lists the NFT inside the owner's rules", methods: ["seller_list", "robot_refuel"] },
};
