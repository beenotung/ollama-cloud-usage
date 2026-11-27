export interface UsageMetrics {
  request_count: number
  usage_usd?: number
  input_tokens?: number
  cached_input_tokens?: number
  output_tokens?: number
}

// One entry of the `group_by=model` breakdown.
export interface UsageGroup extends UsageMetrics {
  model: string
}

// `groups` is present when group_by is requested (top 10, ranked by cost or
// request count); `remainder` folds in everything outside that limit.
export interface UsageSummary extends UsageMetrics {
  groups?: UsageGroup[]
  remainder?: UsageMetrics
}

export interface UsageBucket extends UsageSummary {
  from: string
  until: string
  partial?: boolean
}

export interface UsageReport {
  range: "24h" | "7d" | "30d"
  scope: "self" | "team"
  granularity: "hour" | "day"
  group_by?: "model"
  from: string
  until: string
  totals: UsageSummary
  buckets: UsageBucket[]
}

// Legacy plan: session/weekly percentages with authoritative reset times.
export interface PlanLimit {
  remaining_percent: number
  resets_at: string
}

// Credit plan: remaining allowance and the billing period.
export interface Balance {
  included: {
    session?: PlanLimit
    weekly?: PlanLimit
    balance_usd?: number
    allowance_usd?: number
    period?: { from: string; until: string }
  }
  purchased?: { balance_usd: number }
}

export async function fetchUsage(
  key: string,
  options: { range?: string; groupBy?: "model" } = {},
): Promise<UsageReport> {
  let range = options.range || "7d"
  let url = `https://ollama.com/api/usage?range=${range}`
  if (options.groupBy) url += `&group_by=${options.groupBy}`
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function fetchBalance(key: string): Promise<Balance> {
  let res = await fetch("https://ollama.com/api/balance", {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`)
  return res.json()
}

// true when the plan has session/weekly limits (legacy plans). Credit plans
// report balance_usd / allowance_usd instead.
export function hasLimits(balance: Balance): boolean {
  return Boolean(balance && balance.included && balance.included.session && balance.included.weekly)
}
