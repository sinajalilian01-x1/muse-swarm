import { fetchIpfs } from "@/lib/ipfs";
import { getJobs } from "@/lib/swarm";
import { rateLimit } from "@/lib/ratelimit";
import { sniffImage, mediaHeaders, MEDIA_MAX_BYTES } from "@/lib/guards";

/**
 * Same-origin proxy for IPFS art, so the 3D easel (WebGL) can paint it. CIDs are immutable, so cache forever.
 * MS-03: only CIDs the swarm itself recorded on-chain (job media) are served; the type comes from magic bytes
 * (raster images, or our own SVG under a sandboxing CSP), never from the upstream header; nosniff,
 * inline disposition, a size cap and a per-IP rate limit apply.
 */
let known: { t: number; set: Set<string> } | null = null;
async function swarmMedia(fresh = false): Promise<Set<string>> {
  if (!fresh && known && Date.now() - known.t < 60_000) return known.set;
  // get_jobs returns at most 50 per page: walk back through every job (bounded to 20 pages).
  const jobs: Awaited<ReturnType<typeof getJobs>> = [];
  let before: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await getJobs(before, 50);
    jobs.push(...page);
    if (page.length < 50) break;
    before = page[page.length - 1].id;
  }
  const set = new Set(jobs.map((j) => (j.media || "").replace(/^ipfs:\/\//, "").replace(/^https?:\/\/[^/]+\/ipfs\//, "")).filter(Boolean));
  known = { t: Date.now(), set };
  return set;
}

export async function GET(req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const { cid } = await ctx.params;
  if (!/^[a-zA-Z0-9]{46,100}$/.test(cid)) return new Response("bad cid", { status: 400 });
  if (!rateLimit(req, "media", 240, 60_000).ok) return new Response("slow down", { status: 429 });
  try {
    let set = await swarmMedia();
    if (!set.has(cid)) set = await swarmMedia(true);
    if (!set.has(cid)) return new Response("unknown media", { status: 404, headers: { "x-content-type-options": "nosniff" } });
    const { bytes } = await fetchIpfs(cid, MEDIA_MAX_BYTES);
    const type = sniffImage(bytes);
    if (!type) return new Response("unsupported media", { status: 415, headers: { "x-content-type-options": "nosniff" } });
    return new Response(new Uint8Array(bytes), { headers: mediaHeaders(type) });
  } catch {
    return new Response("not found", { status: 404, headers: { "x-content-type-options": "nosniff" } });
  }
}
