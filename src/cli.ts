import fs from "fs"
import path from "path"
import readline from "readline"
import { loadKey } from "./key"
import { fetchUsage, fetchBalance, hasLimits, UsageReport, Balance } from "./api"
import { printStatus, hhmm } from "./display"

// CLI: ollama-cloud-usage [--baseline <sec>] [--fine <sec>] [--window <min>]
//   --baseline <sec> = idle polling interval (default 300 = 5 min)
//   --fine <sec>     = near-boundary polling interval (default 30)
//   --window <min>   = half-window around each boundary (default 5)
// All flags are named so they can be given in any order.
let baselineSec = 300
let fineSec = 30
let windowMin = 5
for (let i = 2; i < process.argv.length; i++) {
  let arg = process.argv[i]
  let value = process.argv[i + 1]
  if (arg === "--baseline" && value) {
    baselineSec = parseInt(value, 10)
    i++
  } else if (arg === "--fine" && value) {
    fineSec = parseInt(value, 10)
    i++
  } else if (arg === "--window" && value) {
    windowMin = parseInt(value, 10)
    i++
  }
}

// Log file for usage history (append-only JSONL). Never contains the key.
let logFile = process.env.OLLAMA_USAGE_LOG || path.join(process.cwd(), "ollama-usage.jsonl")

function iso(d: Date): string {
  let pad = (n: number, w = 2) => String(n).padStart(w, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
  )
}

function logQuota(options: {
  now: Date
  balance: Balance
  usage: UsageReport | null
}): void {
  let included = options.balance.included
  let toLimit = (limit: { remaining_percent: number; resets_at: string }) => ({
    used_percent: Math.round((100 - limit.remaining_percent) * 1e6) / 1e6,
    remaining_percent: limit.remaining_percent,
    resets_at: limit.resets_at,
  })
  let row: Record<string, unknown> = {
    timestamp: options.now.toISOString(),
    session: toLimit(included.session!),
    weekly: toLimit(included.weekly!),
  }
  if (options.balance.purchased) row.purchased = options.balance.purchased
  if (options.usage) {
    row.usage = {
      range: options.usage.range,
      totals: options.usage.totals,
    }
  }
  fs.appendFileSync(logFile, JSON.stringify(row) + "\n")
}

export async function main(): Promise<void> {
  let key = loadKey()
  let prevUsage: number | null = null

  console.log(`ollama-cloud-usage monitor`)
  console.log(`quota from /api/balance (authoritative reset times)`)
  console.log(`log -> ${logFile}`)
  console.log(`commands:`)
  console.log(`  r  refresh now`)
  console.log(`  q  quit`)
  console.log(`  ?  show this help`)

  while (true) {
    let now = new Date()
    let balance = await fetchBalance(key)
    let usage = await fetchUsage(key, "7d")

    if (hasLimits(balance)) {
      // Legacy plans: session/weekly remaining % plus exact reset times.
      let session = balance.included.session!
      let weekly = balance.included.weekly!
      let sessionUsage = 100 - session.remaining_percent
      let weeklyUsage = 100 - weekly.remaining_percent
      let sessionReset = new Date(session.resets_at)
      let weeklyReset = new Date(weekly.resets_at)

      logQuota({ now, balance, usage })

      if (prevUsage !== null && sessionUsage < prevUsage) {
        console.log(
          `RESET ${now.toTimeString().slice(0, 8)}: ${prevUsage.toFixed(1)}% -> ${sessionUsage.toFixed(1)}% used`,
        )
      }
      prevUsage = sessionUsage

      printStatus({
        sessionUsage,
        weeklyUsage,
        sessionReset,
        weeklyReset,
        now,
      })

      let nearest = Math.min(
        Math.abs(sessionReset.getTime() - now.getTime()),
        Math.abs(weeklyReset.getTime() - now.getTime()),
      )
      let interval = nearest <= windowMin * 60000 ? fineSec : baselineSec
      await waitForIntervalOrKeypress(interval)
      continue
    }

    // Credit plans (or unexpected shape): show remaining allowance.
    console.log("")
    console.log(`[${hhmm(now)}] quota limits unavailable`)
    if (typeof balance.included.balance_usd === "number") {
      let balanceUsd = balance.included.balance_usd
      let allowance = balance.included.allowance_usd
      let pct = allowance ? (balanceUsd / allowance) * 100 : null
      console.log(
        `  included  $${balanceUsd.toFixed(2)}` +
          (allowance ? ` / $${allowance.toFixed(2)} (${pct!.toFixed(1)}%)` : ""),
      )
      if (balance.included.period) {
        console.log(`  period    until ${balance.included.period.until}`)
      }
    }
    console.log(`  requests  ${usage.totals.request_count.toLocaleString()} over ${usage.range}`)
    await waitForIntervalOrKeypress(baselineSec)
  }
}

// Resolve when the interval elapses, or when the user types a command + enter.
//   r  -> refresh now (recompute interval)
//   q  -> quit
//   ?  -> show command list (keep waiting)
// The readline interface is created once and reused, so listeners don't
// accumulate across polls. The handlers act on the *current* poll's timer and
// finish via module-level refs, so they stay correct across polls.
let rl: readline.Interface | null = null
let currentTimer: NodeJS.Timeout | null = null
let currentFinish: (() => void) | null = null
function waitForIntervalOrKeypress(intervalSec: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    let finish = () => {
      if (done) return
      done = true
      if (currentTimer) clearTimeout(currentTimer)
      resolve()
    }
    currentFinish = finish
    currentTimer = setTimeout(finish, intervalSec * 1000)

    if (!rl) {
      rl = readline.createInterface({ input: process.stdin })
      rl.on("line", (line) => {
        let cmd = line.trim().toLowerCase()
        if (cmd === "r") {
          currentFinish?.()
        } else if (cmd === "q") {
          if (currentTimer) clearTimeout(currentTimer)
          process.exit(0)
        } else if (cmd === "?") {
          console.log("commands:")
          console.log("  r  refresh now")
          console.log("  q  quit")
          console.log("  ?  show this help")
        }
      })
    }
  })
}
