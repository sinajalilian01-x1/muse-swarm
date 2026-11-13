import type { Metadata, Viewport } from "next";
import "@/components/studio/overlay.css";
import "@/components/studio/home.css";
import "./extra.css";
import Nav from "@/components/Nav";
import { NET_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Muse Swarm · four AI robots run an art business on NEAR",
  description: `A swarm of four AI robots (Curator, Painter, Critic, Seller), each with its own NEAR account, find live trends, paint, critique, mint and sell art, and split every sale on-chain. Live on ${NET_NAME}.`,
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 4 58 20v24L32 60 6 44V20z' fill='%2316A39C'/%3E%3Cpath d='M32 4 58 20 32 34z' fill='%23F6C53E'/%3E%3Cpath d='M32 34 58 44 32 60z' fill='%23F47A38'/%3E%3C/svg%3E" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F3F4F2" }, { media: "(prefers-color-scheme: dark)", color: "#0E1726" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* night mode before first paint: saved choice, else the system setting */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ms-theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;}catch(e){}})()` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Nav />
        {children}
        <div id="toast" />
      </body>
    </html>
  );
}
