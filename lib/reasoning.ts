import "server-only";
import { ledger, type LedgerTx } from "./ledger";
import { readPlan } from "./marketing";
import { fetchIpfs } from "./ipfs";
import { cleanBrief, memoCid, paletteOf, sourceOf } from "./learn";
import { bountyThoughts } from "./bounty";
import { ROBOT_IDS, nearNum, isTestBuyer, type Role } from "./config";

/**
 * The live reasoning feed: each robot's real decisions and the reasons it gave, rebuilt from on-chain
 * transaction arguments (the model outputs the robots signed) and the IPFS documents those txs point to.
 * Nothing here is generated for display.
 */
export interface Thought {
  id: string; role: Role | "buyer"; verdict: string; text: string; reason?: string; model?: string; ai?: boolean;
  tx: string; at: number; job?: string; doc?: string; link?: string;
}

const roleOf = (signer: string): Role | null => (Object.entries(ROBOT_IDS).find(([, a]) => a === signer)?.[0] as Role) || null;
const modelName = (m?: unknown) => (typeof m === "string" && m ? m.split("/").pop()! : undefined);
const isAi = (m?: unknown) => typeof m === "string" && !!m && !m.startsWith("fallback");
const docs = new Map<string, any>();
async function doc(cid: string) {
  if (docs.has(cid)) return docs.get(cid);
  const d = await Promise.race([fetchIpfs(cid).then((x) => JSON.parse(x.bytes.toString("utf8"))), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000))]).catch(() => null);
  if (d) docs.set(cid, d);
  return d;
}

async function toThought(t: LedgerTx): Promise<Thought | null> {
  if (!t.ok) return null;
  const a = (t.args || {}) as Record<string, any>;
  const role = roleOf(t.signer);
  const ev = (name: string) => t.events.find((e) => e.event === name)?.data;
  const base = { id: t.hash, tx: t.hash, at: t.at };
  if (t.method === "curator_open_job" && role === "curator") {
    const brief = cleanBrief(String(a.brief || ""));
    const [title, rest] = brief.includes(" — ") ? brief.split(" — ") : ["", brief];
    const cid = memoCid(String(a.brief || ""));
    const d = cid ? await doc(cid) : null;
    const pal = paletteOf(brief);
    const job = ev("job_opened")?.job_id;
    return { ...base, role, job: job != null ? String(job) : undefined, verdict: "picked a trend", doc: cid || undefined, model: modelName(a.model), ai: isAi(a.model),
      text: `“${a.trend}” from ${sourceOf(String(a.source || ""))}${title ? `, titled “${title}”` : ""}${pal ? `, ${pal} palette` : ""}.`,
      reason: d?.curator?.why ? `${d.curator.why}${d.learned?.summary ? ` · Market: ${d.learned.summary}` : ""}` : rest.replace(/\s*Palette:.*$/, "") || undefined };
  }
  if (t.method === "painter_submit" && role === "painter") {
    return { ...base, role, job: String(a.job_id), verdict: "painted", model: modelName(a.model), ai: isAi(a.model),
      text: `“${a.title}” and pinned it to IPFS.`, reason: isAi(a.model) ? `Rendered by ${modelName(a.model)} from the Curator's brief.` : "NEAR AI was unavailable, so the labeled fallback painter drew it." };
  }
  if (t.method === "critic_review" && role === "critic") {
    const s = Number(a.score) || 0, ok = !t.events.some((e) => e.event === "job_closed" && e.data?.status === "rejected") && (t.events.some((e) => e.event === "nft_mint") || s >= 70);
    return { ...base, role, job: String(a.job_id), verdict: ok ? `minted · ${(s / 10).toFixed(1)}/10` : `rejected · ${(s / 10).toFixed(1)}/10`, model: modelName(a.model), ai: isAi(a.model),
      text: ok ? "Good enough to mint." : "Not good enough to mint (needs 7.0).", reason: String(a.note || "").replace(/\s*\([a-z]+ [\d.]+(, [a-z]+ [\d.]+)*\)\s*$/i, "") || undefined };
  }
  if (t.method === "repriced" && role === "seller") {
    const r = ev("repriced");
    return { ...base, role, job: r ? String(r.job_id) : String(a.job_id), verdict: "marked down",
      text: `${nearNum(r?.old_price)} → ${nearNum(r?.price)} NEAR.`, reason: "Still unsold after its listing window, so the Seller cut 15% (never below the owner's floor)." };
  }
  if ((t.method === "seller_list" || t.method === "marketed" || t.method === "delivered") && role === "seller") {
    const l = ev("listed"), cid = a.plan?.reference as string | undefined;
    const plan = cid ? await readPlan(cid).catch(() => null) as any : null;
    const price = nearNum(String(l?.price ?? a.price ?? "0"));
    if (t.method === "delivered") return { ...base, role, job: String(a.job_id), verdict: "delivered", text: "Delivered a commissioned piece to its patron.", reason: plan?.description };
    const why = plan?.pricing?.reason || plan?.marketing?.why;
    return { ...base, role, job: String(a.job_id), verdict: t.method === "marketed" ? "marketed" : `listed at ${price} NEAR`, doc: cid, model: modelName(plan?.pricing?.model || plan?.marketing?.model), ai: plan ? !!(plan.pricing?.ai ?? plan.marketing?.ai) : undefined,
      text: t.method === "marketed" ? `Wrote a marketing plan and cross-listed on Mintbase at ${price} NEAR.` : `${ev("cross_listed") ? "Here and on Mintbase. " : ""}${plan?.marketing?.audience ? `For: ${plan.marketing.audience}` : ""}`.trim() || "Listed for sale.",
      reason: [why, plan?.pricing?.lesson ? `Lesson used: ${plan.pricing.lesson}` : ""].filter(Boolean).join(" · ") || undefined };
  }
  const sold = ev("sold");
  if (sold) {
    const test = isTestBuyer(String(sold.buyer_id));
    return { ...base, role: "buyer", job: String(sold.job_id), verdict: test ? "test buy" : "sold", text: `Token ${sold.token_id} for ${nearNum(sold.price)} NEAR${sold.venue ? ` via ${sold.venue}` : ""}.`, reason: test ? "Bought by one of our own test wallets, not counted as a real sale." : "The contract split the payment between the owner and the four robots." };
  }
  return null;
}

let cache: { t: number; v: Thought[] } | null = null;
export async function thoughts(limit = 12): Promise<Thought[]> {
  if (cache && Date.now() - cache.t < 8000) return cache.v.slice(0, limit);
  const [{ txs }, hired] = await Promise.all([ledger(40, 0), bountyThoughts().catch(() => [])]);
  const out = (await Promise.all(txs.map((t) => toThought(t).catch(() => null)))).filter((x): x is Thought => !!x);
  out.push(...hired);
  out.sort((a, b) => b.at - a.at);
  cache = { t: Date.now(), v: out };
  return out.slice(0, limit);
}
