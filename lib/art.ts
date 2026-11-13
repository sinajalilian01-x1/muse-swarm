// Fallback painter: a deterministic low-poly generative painter (runs on our server, no AI).
// Used only when NEAR_AI_API_KEY is not set. Every artwork it makes is labeled "fallback painter".

export type Scene = "sea" | "peaks" | "hills" | "city" | "cosmos" | "bloom";
export interface Palette { name: string; sky: [string, string]; sun: string; layers: string[] }

export const PALETTES: Palette[] = [
  { name: "Coral Dusk", sky: ["#FF9E7A", "#FFE3B3"], sun: "#FFF6DA", layers: ["#4C7FB5", "#35659A", "#22497A", "#173560"] },
  { name: "Mint Lagoon", sky: ["#9FE3CF", "#F1FFF8"], sun: "#FFFDF0", layers: ["#4DC2B4", "#2F9F95", "#1C7772", "#13524F"] },
  { name: "Lemon Grove", sky: ["#FFE07A", "#FFF9E0"], sun: "#FFFFFF", layers: ["#A6D277", "#7CB653", "#56913B", "#3A6A2A"] },
  { name: "Alpine Dawn", sky: ["#FFB8A0", "#FFF0E0"], sun: "#FFFFFF", layers: ["#A9C2E0", "#7C9DC8", "#4E73A6", "#2E4F7E"] },
  { name: "Desert Gold", sky: ["#7EC8E3", "#E9F6F2"], sun: "#FFF9E8", layers: ["#F6CF95", "#EBAA68", "#D9844C", "#B9653A"] },
  { name: "Night Market", sky: ["#13243F", "#3B4F7A"], sun: "#F6C53E", layers: ["#F47A38", "#E86A8C", "#16A39C", "#0E2A47"] },
  { name: "Berry Pop", sky: ["#F48AA6", "#FFE3EC"], sun: "#FFF4D2", layers: ["#E0567F", "#B53D66", "#7E2A52", "#4F1D3A"] },
  { name: "Teal Tide", sky: ["#BFFFF6", "#FFFFFF"], sun: "#F6C53E", layers: ["#16A39C", "#0E7F7A", "#0F4A4A", "#13243F"] },
];

const SCENE_WORDS: [Scene, RegExp][] = [
  ["sea", /surf|sea|ocean|beach|wave|rain|storm|hurricane|flood|river|lake|boat|sail|fish|island|tide|swim/i],
  ["peaks", /mountain|snow|ski|winter|hike|alps|everest|glacier|cold|frost|climb/i],
  ["cosmos", /space|nasa|launch|rocket|moon|star|comet|eclipse|aurora|planet|mars|satellite|meteor|galaxy|night|astronom/i],
  ["bloom", /music|concert|album|tour|song|festival|film|movie|show|season|award|dance|art|fashion|flower|love|wedding|halloween|christmas|holiday/i],
  ["city", /game|match| vs |nba|nfl|nhl|mlb|league|cup|football|soccer|tech|ai\b|app|apple|google|nvidia|chip|phone|launch|stock|market|city|bitcoin|crypto/i],
];

export function hashSeed(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * Math.max(0, Math.min(1, t)))); };
const shade = (c: string, k: number) => { const A = hex(c); return toHex(A.map((v) => (k >= 0 ? v + (255 - v) * k : v * (1 + k)))); };
const lum = (c: string) => { const [r, g, b] = hex(c).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

export function sceneFor(text: string, seed: number): Scene {
  for (const [s, re] of SCENE_WORDS) if (re.test(` ${text} `)) return s;
  const all: Scene[] = ["sea", "peaks", "hills", "city", "cosmos", "bloom"];
  return all[seed % all.length];
}

export interface Painted { svg: string; scene: Scene; palette: Palette; metrics: { contrast: number; harmony: number; balance: number; detail: number } }

export function paintLowPoly(seedStr: string, scene: Scene, palette: Palette): Painted {
  const seed = hashSeed(seedStr), r = rng(seed);
  const W = 800, H = 1000, cols = 20, rows = 25;
  const horizon = scene === "sea" ? 0.56 : scene === "city" ? 0.62 : scene === "cosmos" ? 1.1 : 0.5;
  const sx = 0.3 + r() * 0.4, sy = scene === "cosmos" ? 0.38 + r() * 0.2 : horizon - 0.12 - r() * 0.12, sr = scene === "cosmos" ? 0.2 + r() * 0.06 : 0.09 + r() * 0.04;
  const L = palette.layers;
  const ridges = L.map((_, i) => ({ ph: r() * 6.28, fr: 1.4 + r() * 2.2, amp: scene === "peaks" ? 0.16 - i * 0.03 : 0.05 - i * 0.008, base: horizon + (i / L.length) * (1 - horizon) * 0.85 - (scene === "peaks" && i === 0 ? 0.1 : 0) }));
  const blocks: { x0: number; x1: number; h: number; layer: number }[] = [];
  if (scene === "city") for (let layer = 0; layer < 3; layer++) { let x = -0.05; while (x < 1.05) { const w = 0.05 + r() * 0.09; blocks.push({ x0: x, x1: x + w, h: (0.18 + r() * 0.3) * (1 - layer * 0.25), layer }); x += w + r() * 0.02; } }
  const petals = 5 + Math.floor(r() * 4), stars = Array.from({ length: 26 }, () => [r(), r() * 0.9]);

  const sky = (v: number) => mix(palette.sky[0], palette.sky[1], v / Math.max(0.3, Math.min(1, horizon)));
  function color(u: number, v: number): string {
    // sun / planet
    const d = Math.hypot((u - sx) * (W / H), v - sy);
    if (scene === "cosmos") {
      let c = mix(palette.sky[0], palette.sky[1], v);
      for (const [x, y] of stars) if (Math.hypot(u - x, v - y) < 0.012) c = "#FFFFFF";
      if (d < sr) { const band = Math.sin((v - sy) * 40 + u * 6) > 0.3; c = band ? L[0] : mix(palette.sun, L[1], (v - sy + sr) / (2 * sr)); }
      const ring = Math.abs(Math.hypot((u - sx) * 1.0, (v - sy) * 3.2) - sr * 1.35);
      if (ring < 0.02 && !(d < sr && v < sy)) c = palette.sun;
      if (v > 0.86) c = mix(L[2], L[3], (v - 0.86) / 0.14 + Math.sin(u * 20) * 0.1);
      return c;
    }
    if (scene === "bloom") {
      const cx = 0.5, cy = 0.46, du = (u - cx) * (W / H), dv = v - cy, rr = Math.hypot(du, dv), th = Math.atan2(dv, du);
      const edge = 0.3 * (0.65 + 0.35 * Math.cos(petals * th));
      if (rr < 0.07) return palette.sun;
      if (rr < edge) return mix(L[0], L[1], rr / edge);
      if (rr < edge + 0.05) return mix(L[1], L[2], 0.5);
      if (v > 0.8) return mix(L[2], L[3], (v - 0.8) / 0.2);
      return mix(palette.sky[0], palette.sky[1], v);
    }
    let c = sky(v);
    if (d < sr * 2.4) c = mix(palette.sun, c, Math.min(1, Math.max(0, (d - sr) / (sr * 1.4))) * 0.85 + 0.15);
    if (d < sr) c = palette.sun;
    if (scene === "sea" && v > horizon) {
      const t = (v - horizon) / (1 - horizon);
      c = t < 0.33 ? mix(L[0], L[1], t * 3) : t < 0.66 ? mix(L[1], L[2], (t - 0.33) * 3) : mix(L[2], L[3], (t - 0.66) * 3);
      if (Math.abs(u - sx) < 0.04 + t * 0.12 && Math.sin(v * 90) > 0.1) c = mix(c, palette.sun, 0.7 - t * 0.4);
      return c;
    }
    if (scene === "city") {
      for (const b of blocks.filter((x) => x.layer === 2).concat(blocks.filter((x) => x.layer === 1), blocks.filter((x) => x.layer === 0)))
        if (u >= b.x0 && u < b.x1 && v > horizon + 0.25 - b.h) c = L[Math.min(L.length - 1, 2 - b.layer + 1)];
      if (v > horizon + 0.25) c = mix(L[3], L[2], (1 - v) * 2);
      return c;
    }
    for (let i = 0; i < ridges.length; i++) {
      const R = ridges[i];
      const wave = scene === "peaks" ? Math.abs(((u * R.fr + R.ph) % 1) - 0.5) * 2 : 0.5 + 0.5 * Math.sin(u * Math.PI * R.fr + R.ph);
      if (v > R.base - wave * R.amp * (scene === "peaks" ? 1.6 : 1)) { c = L[i]; if (scene === "peaks" && i === 0 && v < R.base - R.amp * 0.6) c = "#FFFFFF"; }
    }
    return c;
  }
  // jittered grid
  const P: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) { P[j] = []; for (let i = 0; i <= cols; i++) { const ex = i === 0 || i === cols, ey = j === 0 || j === rows; P[j][i] = [(i + (ex ? 0 : (r() - 0.5) * 0.8)) * (W / cols), (j + (ey ? 0 : (r() - 0.5) * 0.8)) * (H / rows)]; } }
  const out: string[] = []; const fills: string[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const cu = (a[0] + b[0] + c[0]) / 3 / W, cv = (a[1] + b[1] + c[1]) / 3 / H;
    const f = shade(color(cu, cv), (r() - 0.5) * 0.12 + (b[0] > a[0] ? 0.03 : -0.03));
    fills.push(f);
    out.push(`<path d="M${a[0].toFixed(0)} ${a[1].toFixed(0)}L${b[0].toFixed(0)} ${b[1].toFixed(0)}L${c[0].toFixed(0)} ${c[1].toFixed(0)}Z" fill="${f}" stroke="${f}"/>`);
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    if ((i + j) % 2) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">${out.join("")}</svg>`;
  // simple, honest metrics for the fallback critic
  const ls = fills.map(lum); const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
  const contrast = Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / ls.length); // ~0.08..0.3
  const coarse = new Set(fills.map((f) => hex(f).map((v) => v >> 5).join(","))).size; // 3-bit/channel color buckets
  const harmony = Math.max(0, Math.min(1, 1 - (coarse - 10) / 30));
  const detail = Math.max(0, Math.min(1, (coarse - 4) / 14));
  const balance = Math.max(0, Math.min(1, 1 - Math.abs(sx - 0.5) * 1.6 + (Math.abs(sx - 0.33) < 0.06 || Math.abs(sx - 0.66) < 0.06 ? 0.3 : 0)));
  return { svg, scene, palette, metrics: { contrast, harmony, balance, detail } };
}

/** Fallback critic: scores from measured contrast, color harmony, composition and detail (0-100). */
export function fallbackCritique(m: Painted["metrics"], seedStr: string) {
  const r = rng(hashSeed(seedStr + ":critic"));
  const parts = { contrast: Math.min(1, m.contrast / 0.22), harmony: m.harmony, balance: m.balance, detail: m.detail };
  const raw = 0.32 * parts.contrast + 0.24 * parts.harmony + 0.24 * parts.balance + 0.2 * parts.detail;
  const score = Math.round(Math.max(40, Math.min(97, 32 + raw * 52 + (r() - 0.5) * 22)));
  const best = Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0];
  const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0];
  const pick = (a: string[]) => a[Math.floor(r() * a.length)];
  const praise: Record<string, string[]> = {
    contrast: ["Strong light and dark", "The values really pop", "Bold contrast carries it"],
    harmony: ["The palette sings", "Colors sit together beautifully", "Lovely, calm color harmony"],
    balance: ["Lovely composition", "The eye lands right where it should", "Well-balanced layout"],
    detail: ["Rich facets", "The low-poly texture is gorgeous", "Plenty of detail to explore"],
  };
  const fix: Record<string, string[]> = {
    contrast: ["needs more contrast", "the darks are a bit muddy", "it reads a little washed out"],
    harmony: ["colors fight a bit", "one hue shouts over the rest", "the palette feels busy"],
    balance: ["the focal point drifts", "the weight sits off to one side", "the horizon feels crowded"],
    detail: ["a little flat", "too few facets up close", "the foreground lacks texture"],
  };
  const stat = `(contrast ${parts.contrast.toFixed(2)}, harmony ${parts.harmony.toFixed(2)}, balance ${parts.balance.toFixed(2)}, detail ${parts.detail.toFixed(2)})`;
  return { score, note: (score >= 70 ? `${pick(praise[best])}. Only nit: ${pick(fix[worst])}.` : `${pick(praise[best])}, but ${pick(fix[worst])}. Not good enough to mint.`) + ` ${stat}`, parts };
}

export function titleFor(trend: string, scene: Scene, palette: Palette, seed: number) {
  const words: Record<Scene, string[]> = { sea: ["Tide", "Swell", "Harbor"], peaks: ["Summit", "Ridge", "Crest"], hills: ["Meadow", "Valley", "Fields"], city: ["Skyline", "Arena", "Blocks"], cosmos: ["Orbit", "Signal", "Night Sky"], bloom: ["Bloom", "Encore", "Petals"] };
  const t = trend.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").slice(0, 3).join(" ");
  const w = words[scene][seed % 3];
  return `${t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) + " " : ""}${w}`.slice(0, 40) + (seed % 4 === 0 ? `, ${palette.name}` : "");
}
