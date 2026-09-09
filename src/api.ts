export interface ModelCount {
  name: string
  request_count: number
}

export interface Limit {
  usage: number // 0-1 fraction
  models: ModelCount[]
}

export interface Usage {
  limits: {
    session: Limit
    weekly: Limit
  }
}

export async function fetchUsage(key: string): Promise<Usage> {
  let res = await fetch("https://ollama.com/api/usage", {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`)
  return res.json()
}
