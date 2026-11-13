import type { ChainEvent } from "./types";
export function eventsFromLogs(logs: string[]): ChainEvent[] {
  const out: ChainEvent[] = [];
  for (const log of logs || []) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    try {
      const j = JSON.parse(log.slice(11));
      for (const d of j.data || [{}]) out.push({ standard: j.standard, event: j.event, data: d });
    } catch {}
  }
  return out;
}
export function extractEvents(res: any): ChainEvent[] {
  return (res?.receipts_outcome || []).flatMap((r: any) => eventsFromLogs(r?.outcome?.logs || []));
}
