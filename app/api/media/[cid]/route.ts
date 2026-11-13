import { fetchIpfs } from "@/lib/ipfs";

/** Same-origin proxy for IPFS art, so the 3D easel (WebGL) can paint it. CIDs are immutable, so cache forever. */
export async function GET(_req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const { cid } = await ctx.params;
  if (!/^[a-zA-Z0-9]{46,100}$/.test(cid)) return new Response("bad cid", { status: 400 });
  try {
    const { bytes, mime } = await fetchIpfs(cid);
    const type = bytes.subarray(0, 5).toString() === "<svg " ? "image/svg+xml" : mime;
    return new Response(new Uint8Array(bytes), { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
