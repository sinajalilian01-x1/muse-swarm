import "server-only";
import { ipfsUrl } from "./config";

export async function pin(bytes: Buffer, name: string, mime: string) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not configured");
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), name);
  fd.append("pinataMetadata", JSON.stringify({ name, keyvalues: { app: "muse-swarm" } }));
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: fd, signal: AbortSignal.timeout(25_000) });
  if (!r.ok) throw new Error(`Pinata ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { cid: j.IpfsHash as string, url: ipfsUrl(j.IpfsHash) };
}

export async function fetchIpfs(cid: string): Promise<{ bytes: Buffer; mime: string }> {
  const gws = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/"];
  let last: unknown;
  for (const g of gws) {
    try {
      const r = await fetch(g + cid, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error(`${g} ${r.status}`);
      return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") || "application/octet-stream" };
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("IPFS fetch failed");
}
