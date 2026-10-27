export interface UsageMetrics {
  request_count: number
  usage_usd?: number
  input_tokens?: number
  cached_input_tokens?: number
  output_tokens?: number
}

export interface UsageBucket extends UsageMetrics {
  from: string
  until: string
  partial?: boolean
}

export interface UsageReport {
  range: "24h" | "7d" | "30d"
  scope: "self" | "team"
  granularity: "hour" | "day"
  from: string
  until: string
  totals: UsageMetrics
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

export async function fetchUsage(key: string, range: string = "7d"): Promise<UsageReport> {
  let res = await fetch(`https://ollama.com/api/usage?range=${range}`, {
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
