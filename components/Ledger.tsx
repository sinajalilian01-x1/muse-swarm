"use client";
import { useCallback, useEffect, useState } from "react";
import { who, label, txUrl, fmtTime, short } from "@/lib/ui";
import { toNear, accountUrl, CONTRACT_ID, NET_NAME } from "@/lib/config";

const n = (y: string, d = 4) => toNear(y, d).replace(/\.?0+$/, "") || "0";
function evText(e: any) {
  const d = e.data || {};
  switch (e.event) {
    case "job_opened": return `job #${d.job_id} · trend “${short(d.trend || "", 28)}” (${(() => { try { return new URL(d.source).hostname.replace(/^www\./, ""); } catch { return d.source || ""; } })()})`;
    case "painted": return `job #${d.job_id} · ${short(d.title || "", 26)}`;
    case "approved": case "rejected": return `job #${d.job_id} · score ${(d.score / 10).toFixed(1)}`;
    case "listed": return `${d.token_id} · ${n(d.price, 3)} NEAR`;
    case "sold": return `${d.token_id} → ${short(d.buyer_id || "", 22)} · ${n(d.price, 3)} NEAR${d.venue && d.venue !== "muse-swarm" ? ` · via ${d.venue.split(".")[0].replace(/-v2-beta/, "")} (Mintbase)` : ""}`;
    case "split_paid": return `owner ${n(d.owner_amount)} · robots ${(d.robot_shares || []).map((x: string) => n(x)).join(" / ")}${(() => { const sw = (d.swept || []).reduce((a: bigint, x: string) => a + BigInt(x), 0n); return sw > 0n ? ` · swept to owner ${n(sw.toString())}` : ""; })()}`;
    case "charged": return `${d.role}: fee ${n(d.fee, 5)} → treasury · storage ${n(d.storage, 5)}`;
    case "agent_paid": return `${d.from} paid ${d.to} ${n(d.amount, 4)} NEAR for the ${d.for} (job #${d.job_id})`;
    case "commissioned": return `#${d.commission_id} by ${short(d.patron || "", 22)} · ${n(d.amount, 3)} NEAR${d.paid_with === "wnear" ? " (wNEAR)" : ""} · “${short(d.brief || "", 30)}”`;
    case "commission_started": return `#${d.commission_id} → job #${d.job_id} (attempt ${d.attempt})`;
    case "commission_delivered": return `#${d.commission_id} · NFT ${d.token_id} → ${short(d.patron || "", 22)} · ${n(d.amount, 3)} NEAR split`;
    case "commission_refunded": return `#${d.commission_id} · ${n(d.amount, 3)} NEAR → ${short(d.patron || "", 22)}`;
    case "marketing_plan": return `${d.token_id} · “${short(d.plan?.pitch || "", 48)}” · ${(d.plan?.hashtags || []).slice(0, 3).join(" ")}`;
    case "cross_listed": return `${d.token_id} → ${short(d.market || "", 30)} · ${n(d.price, 3)} NEAR`;
    case "cross_list_failed": return `${d.token_id} on ${short(d.market || "", 26)} (deposit refunded)`;
    case "repriced": return `${d.token_id} · ${n(d.old_price, 3)} → ${n(d.price, 3)} NEAR (unsold, Seller adjusted)`;
    case "refueled": return `${d.role} +${n(d.amount, 3)} NEAR for gas`;
    case "paused": return `${d.seconds}s, until ${new Date(Number(d.until_ms)).toLocaleTimeString()}`;
    case "kill_switch": return d.engaged ? "ENGAGED" : "released";
    case "funded": return `+${n(d.amount, 3)} NEAR`;
    case "rules_updated": return `daily cap ${n(d.rules?.daily_cap || "0", 3)} NEAR per robot · max ${d.rules?.max_jobs_per_day ?? "—"} jobs/day`;
    case "approvals_enabled": return "Marketplace approvals enabled";
    case "metadata_patched": return `NFT ${d.token_id || ""} metadata updated`;
    case "withdrawn": return `${d.role} −${n(d.amount, 3)} NEAR → owner`;
    case "job_closed": return `job #${d.job_id} · ${d.status}`;
    case "nft_mint": return `minted ${(d.token_ids || []).join(", ")}`;
    case "nft_transfer": return `${(d.token_ids || []).join(", ")} → ${short(d.new_owner_id || "", 22)}`;
    default: return Object.keys(d).length ? Object.entries(d).filter(([k]) => !["by", "rules", "budgets"].includes(k)).map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : "";
  }
}

export default function Ledger() {
  const [txs, setTxs] = useState<any[]>([]); const [total, setTotal] = useState(0); const [err, setErr] = useState("");
  const load = useCallback(async (offset = 0) => {
    try { const d = await (await fetch(`/api/ledger?limit=50&offset=${offset}`, { cache: "no-store" })).json(); if (d.error) throw new Error(d.error); setTotal(d.total); setTxs((t) => (offset ? [...t, ...d.txs] : d.txs)); setErr(""); } catch (e: any) { setErr(String(e.message || e)); }
  }, []);
  useEffect(() => { load(); const t = setInterval(() => load(0), 20000); return () => clearInterval(t); }, [load]);
  return (
    <div className="page">
      <h1 className="t">Ledger</h1>
      <p className="sub">Every transaction sent to <a className="lnk" href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a>, rebuilt from {NET_NAME} chain data (FastNear tx API), with the contract&apos;s own NEP-297 events. {total ? `${total} transactions so far, failed ones included.` : ""}</p>
      {err && <p className="notice" style={{ marginTop: 16 }}>Could not load the ledger right now: {err}</p>}
      <div className="card sec ledger-wrap">
        <table className="tx" aria-label="On-chain transactions">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Events</th><th>Gas</th><th>Tx</th></tr></thead>
          <tbody>
            {txs.map((t) => { const w = who(t.signer); return (
              <tr key={t.hash}>
                <td data-label="When" className="k" style={{ whiteSpace: "nowrap" }}>{fmtTime(t.at)}</td>
                <td data-label="Who" style={{ whiteSpace: "nowrap" }}><span className="pill" style={{ background: w.color + "22", color: w.color === "#F6C53E" ? "#946A00" : w.color }}>{w.name}</span></td>
                <td data-label="Action">{t.method === "storage_deposit" ? "paid a storage deposit" : t.method === "CreateAccount" ? "created an account" : label(t.method)}{t.deposit !== "0" && <span className="k"> · {n(t.deposit, 3)} NEAR</span>}{!t.ok && <div className="pill fail" style={{ marginTop: 4 }}>failed: {short(t.error || "", 60)}</div>}</td>
                <td data-label="Events">{t.events.map((e: any, i: number) => <span className="ev" key={i}><b title={e.event}>{e.event.replace(/_/g, " ")}</b> {evText(e)}</span>)}</td>
                <td data-label="Gas (NEAR)" className="k mono">{n(t.burnt, 5)}</td>
                <td data-label="Transaction"><a className="lnk mono" href={txUrl(t.hash)} target="_blank" rel="noreferrer">{t.hash.slice(0, 8)}… ↗</a></td>
              </tr>); })}
          </tbody>
        </table>
        {!txs.length && !err && <p className="k" style={{ padding: 14 }}>Loading transactions…</p>}
      </div>
      {txs.length < total && <div className="btn-row"><button className="btn-sm ghost" onClick={() => load(txs.length)}>Load older</button></div>}
      <p className="foot2">Gas column: NEAR burned for the whole tx (all receipts). {NET_NAME}.</p>
    </div>
  );
}
