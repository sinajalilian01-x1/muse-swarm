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

/** MS-02: our own earlier pin whose name starts with `prefix` (e.g. a job's image), so a retry never pays for it twice. */
export async function findPinned(prefix: string): Promise<{ cid: string; name: string } | null> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  const q = `status=pinned&pageLimit=10&metadata[name]=${encodeURIComponent(prefix)}&metadata[keyvalues]=${encodeURIComponent(JSON.stringify({ app: { value: "muse-swarm", op: "eq" } }))}`;
  const r = await fetch(`https://api.pinata.cloud/data/pinList?${q}`, { headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) return null;
  const rows: { ipfs_pin_hash: string; metadata?: { name?: string; keyvalues?: Record<string, string> } }[] = (await r.json()).rows || [];
  const hit = rows.find((x) => x.metadata?.name?.startsWith(prefix) && x.metadata?.keyvalues?.app === "muse-swarm");
  return hit ? { cid: hit.ipfs_pin_hash, name: hit.metadata!.name! } : null;
}

/** MS-03: fetch with a hard size cap, so the media proxy cannot be used as a bandwidth/memory amplifier. */
export async function fetchIpfs(cid: string, maxBytes = 12 * 1024 * 1024): Promise<{ bytes: Buffer; mime: string }> {
  const gws = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/"];
  let last: unknown;
  for (const g of gws) {
    try {
      const r = await fetch(g + cid, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error(`${g} ${r.status}`);
      if (Number(r.headers.get("content-length") || 0) > maxBytes) throw new Error("too large");
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > maxBytes) throw new Error("too large");
      return { bytes: buf, mime: r.headers.get("content-type") || "application/octet-stream" };
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("IPFS fetch failed");
}
