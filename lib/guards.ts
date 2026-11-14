/**
 * Pure security guards used by the route handlers and the swarm engine (red-team r1 fixes).
 * No I/O here, so every rule is unit-tested in tests/guards.test.ts.
 */

/** MS-06: the owner-approved autonomy window. Nothing autonomous or visitor-driven runs after it. */
export const AUTONOMY_END_MS = Date.parse(process.env.AUTONOMY_END || "2026-11-18T00:00:00+01:00");
export const autonomyEnded = (now = Date.now(), end = AUTONOMY_END_MS) => !(now < end);

/**
 * MS-04: whether a step request would open a new job is decided from chain state, never from the
 * presence of a client-supplied string. A new job is opened only when no job is active.
 */
export const opensNewJob = (activeJob: unknown) => !activeJob;

/** MS-16 / MS-02: an inference fee is clamped under the owner's on-chain per-call cap so the robot tx can never revert on it. */
export function clampFee(feeYocto: string | bigint, feeCapYocto: string | bigint): { fee: string; clamped: boolean } {
  const fee = BigInt(feeYocto), cap = (BigInt(feeCapYocto) * 9n) / 10n;
  return fee > cap ? { fee: cap.toString(), clamped: true } : { fee: fee.toString(), clamped: false };
}

/** MS-05: a public demo pause is refused while paused and for a cooldown after the previous pause ended (read from chain). */
export const PAUSE_COOLDOWN_MS = 10 * 60_000;
export function pauseAllowed(pausedUntilMs: number, now = Date.now()): { ok: boolean; retryAfter: number; reason?: string } {
  if (!pausedUntilMs) return { ok: true, retryAfter: 0 };
  if (now < pausedUntilMs) return { ok: false, retryAfter: Math.ceil((pausedUntilMs - now) / 1000), reason: "already paused" };
  const next = pausedUntilMs + PAUSE_COOLDOWN_MS;
  if (now < next) return { ok: false, retryAfter: Math.ceil((next - now) / 1000), reason: "cooling down" };
  return { ok: true, retryAfter: 0 };
}

/** MS-03: raster image types the media proxy may serve, chosen from magic bytes only (never the upstream header). */
export type SafeMedia = "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/avif" | "image/svg+xml";
export function sniffImage(b: Uint8Array): SafeMedia | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftypavif") || ascii(4, "ftypavis")) return "image/avif";
  // Our own fallback painter's SVGs start with "<svg ". They are served with a sandboxing CSP (no script can run).
  if (ascii(0, "<svg ")) return "image/svg+xml";
  return null;
}
export const MEDIA_MAX_BYTES = 12 * 1024 * 1024;
/** Headers for every media response: no sniffing, inline only, and a CSP that blocks scripts even if the file is opened directly. */
export function mediaHeaders(type: SafeMedia): Record<string, string> {
  return {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
    "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "cross-origin-resource-policy": "same-origin",
    "cache-control": "public, max-age=31536000, immutable",
  };
}

/** MS-11: captions that try to instruct the judge are disqualified before the model sees them. */
const INSTRUCTION = /(ignore|disregard|forget)\b.{0,40}\b(previous|above|prior|instruction|rule)|\b(system|assistant|developer)\s*(prompt|message|:)|\b(pick|choose|select|vote for|declare)\s+(me|this|entry|caption|number|#?\d+)\b|\bwinner\s*(is|=|:)|\byou\s+(must|are now|should)\b|\bjson\b|[{}<>]|\breturn\s*\{/i;
export const instructionLike = (caption: string) => INSTRUCTION.test(caption);

/**
 * MS-07: a judged bounty whose payout was refused for a reason that can never clear (winner account gone,
 * autonomy window over) is terminal ("unpaid"), so it can no longer block the next bounty forever.
 */
export const PERMANENT_REFUSALS = ["winner account not found", "the autonomous window has ended"];
export const isPermanentRefusal = (reason?: string) => !!reason && PERMANENT_REFUSALS.includes(reason);
export type BountyStatus = "open" | "judging" | "paying" | "paid" | "no-winner" | "unpaid";
export function bountyStatus(now: number, deadline: number, judgement: { winner: unknown } | null, payout: { ok: boolean; final?: boolean } | null): BountyStatus {
  if (!judgement) return now < deadline ? "open" : "judging";
  if (!judgement.winner) return "no-winner";
  if (payout?.ok) return "paid";
  if (payout?.final) return "unpaid";
  return "paying";
}
export const isUnsettled = (s: BountyStatus) => s === "open" || s === "judging" || s === "paying";

/** MS-07/MS-10: a 64-hex implicit account is only accepted once it exists on chain (someone controls its key and funded it). */
export const isImplicit = (id: string) => /^[0-9a-f]{64}$/.test(id);

/** MS-17: the job-driver HMAC secret fails closed in production instead of falling back to a public default. */
export function jobSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.JOB_SECRET;
  if (s) return s;
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") throw new Error("JOB_SECRET is not configured");
  return "dev-only-secret";
}
