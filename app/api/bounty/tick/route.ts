import { tick } from "@/lib/bounty";
import { json } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner/cron only (CRON_SECRET): judge and pay a due bounty, and optionally open the next one. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const deadline = Number(body?.deadline) || undefined;
  return json(await tick({ open: !!body?.open, deadline }));
}
