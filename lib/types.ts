export interface Job {
  id: string; status: "briefed" | "painted" | "minted" | "listed" | "sold" | "rejected" | "expired";
  trend: string; source: string; brief: string; title: string; media: string; score: number; note: string;
  token_id: string | null; price: string; buyer: string | null; cost: string; opened_at_ms: string; updated_at_ms: string;
}
export interface Robot {
  role: string; account_id: string; budget: string; spent_today: string; day: string; spent_total: string; fees_total: string;
  storage_total: string; refuel_total: string; earned_total: string; swept_total: string; actions: number;
}
export interface Rules {
  floor: string; max_price: string; score_threshold: number; daily_cap: string; fee_cap: string; budget_cap: string; max_jobs_per_day: number;
  split: { owner: number; curator: number; painter: number; critic: number; seller: number };
}
export interface Stats {
  jobs: number; minted: number; rejected: number; expired: number; sold: number; revenue_total: string; owner_paid_total: string;
  robots_earned_total: string; fees_total: string; storage_total: string; refuel_total: string; funded_total: string; withdrawn_total: string; jobs_today: number; day: string;
}
export interface Swarm {
  owner_id: string; treasury_id: string; guardian_id: string; rules: Rules; robots: Robot[]; stats: Stats; kill_switch: boolean;
  paused_until_ms: string; live: boolean; active_job: Job | null; next_job: string; listings: number; now_ms: string;
}
export interface ChainEvent { standard: string; event: string; data: Record<string, any> }
export interface TxInfo { hash: string; ok: boolean; error?: string; signerId: string; method?: string; at?: number; events?: ChainEvent[] }
