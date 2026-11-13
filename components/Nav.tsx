/* eslint-disable @next/next/no-html-link-for-pages */
"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { connect, disconnect, hasSession, initWallet, onAccount } from "@/lib/wallet";
import { NETWORK } from "@/lib/config";

const LINKS = [["/", "Studio"], ["/how", "How it works"], ["/gallery", "Gallery"], ["/robots", "Robots"], ["/ledger", "Ledger"]] as const;

export default function Nav() {
  const path = usePathname();
  const [acct, setAcct] = useState<string | null>(null);
  useEffect(() => { const off = onAccount(setAcct); if (hasSession()) initWallet(); return off; }, []);
  return (
    <header className="nav">
      <a className="brand" href="/">Muse Swarm<i></i></a>
      <nav className="links">
        {/* full page loads on purpose: the 3D studio owns a render loop */}
        {LINKS.map(([href, label]) => <a key={href} href={href} className={path === href ? "on" : ""}>{label}</a>)}
      </nav>
      <div className="nav-r">
        <span className="live" title={NETWORK === "mainnet" ? "Live on NEAR Mainnet with real NEAR" : "Everything runs on NEAR testnet with test NEAR"}><svg viewBox="0 0 24 24"><path d="M6 18V6l12 12V6" /></svg>Live on NEAR{NETWORK === "mainnet" ? <span className="tn main">Mainnet</span> : <span className="tn">testnet</span>}</span>
        <button className="wallet" title={acct || "Connect a NEAR wallet"} onClick={() => (acct ? (confirm(`Disconnect ${acct}?`) && disconnect()) : connect())}>{acct ? acct : "Connect wallet"}</button>
      </div>
    </header>
  );
}
