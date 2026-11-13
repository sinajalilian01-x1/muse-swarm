import "server-only";
import { PALETTES, paintLowPoly, sceneFor, titleFor, hashSeed, fallbackCritique, type Scene } from "./art";
import type { Trend } from "./trends";

const BASE = process.env.NEAR_AI_BASE_URL || "https://cloud-api.near.ai/v1";
export const TEXT_MODEL = process.env.NEAR_AI_TEXT_MODEL || "Qwen/Qwen3.6-35B-A3B-FP8";
const IMAGE_MODEL = process.env.NEAR_AI_IMAGE_MODEL || "black-forest-labs/FLUX.2-klein-4B";
const VISION_MODEL = process.env.NEAR_AI_VISION_MODEL || "Qwen/Qwen3-VL-30B-A3B-Instruct";
export const key = () => process.env.NEAR_AI_API_KEY || "";
/** Flat compute fees (NEAR, paid to the treasury) when the local fallback brains run instead of NEAR AI. */
const FALLBACK_FEE = { curator: "500000000000000000000", painter: "2000000000000000000000", critic: "1000000000000000000000" };

export function aiMode() {
  const on = !!key();
  return {
    nearAi: on,
    provider: on ? "NEAR AI Cloud" : "Local fallback (no NEAR_AI_API_KEY yet)",
    curator: on ? TEXT_MODEL : "fallback: keyword curator",
    painter: on ? IMAGE_MODEL : "fallback: low-poly generative painter",
    critic: on ? VISION_MODEL : "fallback: measured contrast/harmony/composition",
  };
}

let priceCache: { v: number; t: number } | null = null;
export async function nearUsd(): Promise<number> {
  if (priceCache && Date.now() - priceCache.t < 10 * 60_000) return priceCache.v;
  try {
    const j = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd", { signal: AbortSignal.timeout(2500) })).json();
    const v = Number(j?.near?.usd);
    if (v > 0) { priceCache = { v, t: Date.now() }; return v; }
  } catch {}
  return 2.5;
}
async function usdToYocto(usd: number) {
  const near = Math.max(usd / (await nearUsd()), 0.0001);
  return BigInt(Math.round(near * 1e9)).toString() + "000000000000000";
}
const tokenUsd = (u: any, inP: number, outP: number) => (u?.prompt_tokens || 0) * inP + (u?.completion_tokens || 0) * outP;

export async function chat(model: string, messages: any[], maxTokens = 500) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model, temperature: 0.8, max_tokens: maxTokens, messages }), signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`NEAR AI ${model} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text: string = (j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("NEAR AI returned no JSON");
  return { data: JSON.parse(m[0]), usage: j.usage || {} };
}

export interface Pick { trend: Trend; brief: string; title: string; line: string; palette: string; scene: Scene; model: string; feeYocto: string; ai: boolean; error?: string }

/** Curator: choose the most paintable, safe trend that the swarm hasn't painted recently and write a brief. */
export async function curatorPick(trends: Trend[], recent: string[]): Promise<Pick> {
  const recentSet = new Set(recent.map((s) => s.toLowerCase()));
  const fresh = trends.filter((t) => !recentSet.has(t.name.toLowerCase()));
  const pool = (fresh.length ? fresh : trends).slice(0, 16);
  if (!pool.length) throw new Error("No trends available right now");
  let error: string | undefined;
  if (key()) {
    try {
      const list = pool.map((t, i) => `${i}. ${t.name} (${t.source}${t.context ? `: ${t.context.slice(0, 90)}` : ""})`).join("\n");
      const { data, usage } = await chat(TEXT_MODEL, [
        { role: "system", content: "You are the Curator robot in Muse Swarm, an AI art studio on NEAR. You pick live trends that make beautiful, uplifting abstract low-poly paintings. Never pick tragedies, politics or real people's likeness. Reply with JSON only." },
        { role: "user", content: `Live trends right now:\n${list}\n\nPalettes: ${PALETTES.map((p) => p.name).join(", ")}.\nScenes: sea, peaks, hills, city, cosmos, bloom.\nReturn {"index": n, "title": "2-4 word artwork title", "brief": "one vivid sentence (max 30 words) describing a low-poly painting inspired by the trend, no people", "palette": "...", "scene": "...", "line": "max 10 words you say to the Painter"}` },
      ]);
      const t = pool[Math.max(0, Math.min(pool.length - 1, Number(data.index) || 0))];
      const palette = PALETTES.find((p) => p.name === data.palette)?.name || PALETTES[hashSeed(t.name) % PALETTES.length].name;
      const scene = (["sea", "peaks", "hills", "city", "cosmos", "bloom"].includes(data.scene) ? data.scene : sceneFor(t.name, hashSeed(t.name))) as Scene;
      return { trend: t, brief: `${String(data.brief).slice(0, 200)} Palette: ${palette}.`, title: String(data.title || t.name).slice(0, 40), line: String(data.line || `${t.name} is trending!`).slice(0, 70),
        palette, scene, model: TEXT_MODEL, feeYocto: await usdToYocto(tokenUsd(usage, 1.7e-7, 1.1e-6)), ai: true };
    } catch (e) { error = (e as Error).message; }
  }
  const t = pool[hashSeed(new Date().toISOString().slice(0, 16)) % Math.min(pool.length, 6)];
  const seed = hashSeed(t.name);
  const scene = sceneFor(`${t.name} ${t.context}`, seed);
  const palette = PALETTES[seed % PALETTES.length];
  const mood: Record<Scene, string> = { sea: "a faceted seascape", peaks: "a crystalline mountain range", hills: "rolling low-poly hills", city: "a geometric skyline", cosmos: "a low-poly night sky with a ringed planet", bloom: "a giant geometric flower" };
  return { trend: t, brief: `${mood[scene]} ${t.source === "Commission" ? `for a patron who asked for “${t.name}”` : `inspired by "${t.name}" trending on ${t.source}`}. Palette: ${palette.name}.`, title: titleFor(t.name, scene, palette, seed), line: `"${t.name}" is trending. Let's paint it!`,
    palette: palette.name, scene, model: "fallback-curator", feeYocto: FALLBACK_FEE.curator, ai: false, error };
}

export interface Painting { bytes: Buffer; mime: string; title: string; model: string; feeYocto: string; ai: boolean; error?: string }

/** Painter: NEAR AI image model, or the local low-poly painter as a labeled fallback. */
export async function painterPaint(jobId: string, trend: string, brief: string, title: string): Promise<Painting> {
  const palette = PALETTES.find((p) => brief.includes(p.name)) || PALETTES[hashSeed(trend) % PALETTES.length];
  let error: string | undefined;
  if (key()) {
    try {
      const prompt = `Low-poly faceted digital painting, geometric triangles, soft studio light, clean and joyful. ${brief.replace(/Palette:.*$/, "")} Colors: ${[palette.sky[0], palette.sun, ...palette.layers].join(", ")}. No text, no letters, no people.`;
      const r = await fetch(`${BASE}/images/generations`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size: "1024x1024", response_format: "b64_json" }), signal: AbortSignal.timeout(45_000),
      });
      if (!r.ok) throw new Error(`NEAR AI image ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      const b64 = j.data?.[0]?.b64_json;
      const bytes = b64 ? Buffer.from(b64, "base64") : j.data?.[0]?.url ? Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer()) : null;
      if (!bytes) throw new Error("NEAR AI image: empty response");
      return { bytes, mime: "image/png", title, model: IMAGE_MODEL, feeYocto: await usdToYocto(0.012), ai: true };
    } catch (e) { error = (e as Error).message; }
  }
  const scene = sceneFor(`${trend} ${brief}`, hashSeed(trend));
  const p = paintLowPoly(jobId, scene, palette);
  return { bytes: Buffer.from(p.svg), mime: "image/svg+xml", title, model: "fallback-lowpoly-painter", feeYocto: FALLBACK_FEE.painter, ai: false, error };
}

/** Rebuild the fallback critic's measurements from the pinned SVG itself. */
function metricsFromSvg(svg: string) {
  const re = /<path d="M(\d+) (\d+)L(\d+) (\d+)L(\d+) (\d+)Z" fill="(#[0-9a-f]{6})"/g;
  const lum = (h: string) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const tris: { x: number; y: number; f: string; l: number }[] = [];
  for (const m of svg.matchAll(re)) tris.push({ x: (+m[1] + +m[3] + +m[5]) / 3 / 800, y: (+m[2] + +m[4] + +m[6]) / 3 / 1000, f: m[7], l: lum(m[7]) });
  if (!tris.length) return null;
  const mean = tris.reduce((a, t) => a + t.l, 0) / tris.length;
  const contrast = Math.sqrt(tris.reduce((a, t) => a + (t.l - mean) ** 2, 0) / tris.length);
  const coarse = new Set(tris.map((t) => [1, 3, 5].map((i) => parseInt(t.f.slice(i, i + 2), 16) >> 5).join(","))).size;
  const bright = [...tris].sort((a, b) => b.l - a.l).slice(0, 12);
  const sx = bright.reduce((a, t) => a + t.x, 0) / bright.length;
  return {
    contrast, harmony: Math.max(0, Math.min(1, 1 - (coarse - 10) / 30)), detail: Math.max(0, Math.min(1, (coarse - 4) / 14)),
    balance: Math.max(0, Math.min(1, 1 - Math.abs(sx - 0.5) * 1.6 + (Math.abs(sx - 0.33) < 0.06 || Math.abs(sx - 0.66) < 0.06 ? 0.3 : 0))),
  };
}

export interface Review { score: number; note: string; line: string; model: string; feeYocto: string; ai: boolean; error?: string }

/** Critic: NEAR AI vision model looks at the actual image; fallback measures the pinned SVG. */
export async function criticReview(jobId: string, brief: string, bytes: Buffer, mime: string): Promise<Review> {
  let error: string | undefined;
  if (key() && mime.startsWith("image/") && !mime.includes("svg")) {
    try {
      const { data, usage } = await chat(VISION_MODEL, [
        { role: "system", content: "You are the Critic robot in Muse Swarm. You are honest and strict: only genuinely good work gets 7.0 or more, and you reject about one in four pieces. Reply with JSON only." },
        { role: "user", content: [
          { type: "text", text: `The brief was: "${brief}". Score this artwork for composition, color harmony, craft and how well it fits the brief. Return {"score": 0-10 with one decimal, "note": "max 16 words of feedback", "line": "max 8 words you say out loud"}` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } },
        ] },
      ], 300);
      const score = Math.round(Math.max(0, Math.min(10, Number(data.score) || 0)) * 10);
      return { score, note: String(data.note || "").slice(0, 150), line: String(data.line || "").slice(0, 60), model: VISION_MODEL, feeYocto: await usdToYocto(tokenUsd(usage, 1.5e-7, 5.5e-7)), ai: true };
    } catch (e) { error = (e as Error).message; }
  }
  const m = mime.includes("svg") ? metricsFromSvg(bytes.toString("utf8")) : null;
  const c = fallbackCritique(m || { contrast: 0.15, harmony: 0.6, balance: 0.6, detail: 0.6 }, jobId);
  return { score: c.score, note: c.note, line: c.score >= 70 ? "A keeper!" : "Hmm. Not this one.", model: "fallback-critic", feeYocto: FALLBACK_FEE.critic, ai: false, error };
}
