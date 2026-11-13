"use client";
import { ROBOT_IDS, ROBOT_META, COLLECTOR_ID, GUARDIAN_ID, OWNER_ID, txUrl } from "./config";
export function toast(msg: string, ms = 3200) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show"); clearTimeout((t as any)._h); (t as any)._h = setTimeout(() => t.classList.remove("show"), ms);
}
export function who(id: string) {
  for (const [r, a] of Object.entries(ROBOT_IDS)) if (a === id) return { name: ROBOT_META[r as keyof typeof ROBOT_META].name, color: ROBOT_META[r as keyof typeof ROBOT_META].color };
  if (id === COLLECTOR_ID) return { name: "Demo collector", color: "#5D6778" };
  if (id === GUARDIAN_ID) return { name: "Guardian", color: "#13243F" };
  if (id === OWNER_ID) return { name: "Owner", color: "#0F4A4A" };
  return { name: id.length > 22 ? id.slice(0, 10) + "…" + id.slice(-8) : id, color: "#8A94A3" };
}
const LABEL: Record<string, string> = {
  curator_open_job: "picked a trend & opened a job", painter_submit: "painted & pinned the art", critic_review: "reviewed the art", seller_list: "listed the NFT",
  buy: "bought an NFT", robot_refuel: "refueled gas from its budget", guardian_pause: "paused the swarm", set_kill_switch: "flipped the kill switch", fund: "funded the robots", new: "deployed the contract",
  update_rules: "changed the rules", marketed: "wrote a marketing plan & listed on Mintbase", nft_transfer_payout: "sold via the Mintbase market", enable_approvals: "enabled marketplace approvals", patch_metadata: "refreshed NFT metadata", repriced: "re-priced an unsold NFT", withdraw: "withdrew from a robot",
};
export const label = (m?: string) => (m ? LABEL[m] || m : "tx");
export { txUrl };
export const short = (s: string, n = 26) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
export const fmtTime = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
