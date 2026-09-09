import fs from "fs"
import path from "path"
import readline from "readline"
import { loadKey } from "./key"
import { fetchUsage } from "./api"
import { nextWeeklyReset, nextSessionReset, SESSION_MS } from "./reset"
import { printStatus } from "./display"

// CLI: ollama-cloud-usage [baseline_sec] [fine_sec] [window_min]
//   baseline_sec = idle polling interval (default 300 = 5 min)
//   fine_sec     = near-boundary polling interval (default 30)
//   window_min   = half-window around each boundary (default 5)
let baselineSec = parseInt(process.argv[2] || "300", 10)
let fineSec = parseInt(process.argv[3] || "30", 10)
let windowMin = parseInt(process.argv[4] || "5", 10)

// Log file for usage history (append-only JSONL). Never contains the key.
let logFile = process.env.OLLAMA_USAGE_LOG || path.join(process.cwd(), "ollama-usage.jsonl")

function iso(d: Date): string {
  let pad = (n: number, w = 2) => String(n).padStart(w, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
  )
}

function logSample(options: { now: Date; usage: number; weekly: number; requests: number; models: Record<string, number> }): void {
  let row = {
    timestamp: options.now.toISOString(),
    session_usage: options.usage,
    weekly_usage: options.weekly,
    session_requests: options.requests,
    session_models: options.models,
  }
  fs.appendFileSync(logFile, JSON.stringify(row) + "\n")
}

export async function main(): Promise<void> {
  let key = loadKey()
  let lastSessionReset: Date | null = null
  let prevUsage: number | null = null

  console.log(`ollama-cloud-usage monitor`)
  console.log(`weekly reset: Monday 00:00 UTC (fixed)`)
  console.log(`session reset: rolling 5h from last observed reset (bootstrap on first run)`)
  console.log(`baseline ${baselineSec}s, fine ${fineSec}s within ±${windowMin}min of boundary`)
  console.log(`log -> ${logFile}`)
  console.log(`commands:`)
  console.log(`  r  refresh now`)
  console.log(`  q  quit`)
  console.log(`  ?  show this help`)

  while (true) {
    let now = new Date()
    let data = await fetchUsage(key)
    let usage = data.limits.session.usage
    let weekly = data.limits.weekly.usage
    let requests = data.limits.session.models.reduce((a, m) => a + m.request_count, 0)
    let models: Record<string, number> = {}
    for (let m of data.limits.session.models) models[m.name] = m.request_count

    logSample({ now, usage, weekly, requests, models })

    // detect session reset (usage dropped) -> re-anchor the rolling chain.
    // usage only increases within a window, so any drop is a reset.
    if (prevUsage !== null && usage < prevUsage) {
      lastSessionReset = now
      console.log(`RESET ${now.toTimeString().slice(0, 8)}: ${prevUsage} -> ${usage} (${requests} req)`)
    }
    prevUsage = usage

    let weeklyReset = nextWeeklyReset(now)
    let sessionReset = nextSessionReset(now, lastSessionReset)
    printStatus({
      sessionUsage: usage * 100,
      weeklyUsage: weekly * 100,
      sessionReset,
      weeklyReset,
      now,
    })

    // pick interval: fine near either boundary, coarse otherwise
    let nearest = Infinity
    if (sessionReset) nearest = Math.min(nearest, Math.abs(sessionReset.getTime() - now.getTime()))
    nearest = Math.min(nearest, Math.abs(weeklyReset.getTime() - now.getTime()))
    let interval = nearest <= windowMin * 60000 ? fineSec : baselineSec

    // wait for the interval, or an 'r' + enter to poll immediately
    await waitForIntervalOrKeypress(interval)
  }
}

// Resolve when the interval elapses, or when the user types a command + enter.
//   r  -> refresh now (recompute interval)
//   q  -> quit
//   ?  -> show command list (keep waiting)
function waitForIntervalOrKeypress(intervalSec: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    let finish = () => {
      if (done) return
      done = true
      resolve()
    }
    let timer = setTimeout(finish, intervalSec * 1000)

    let rl = readline.createInterface({ input: process.stdin })
    rl.on("line", (line) => {
      let cmd = line.trim().toLowerCase()
      if (cmd === "r") {
        clearTimeout(timer)
        rl.close()
        finish()
      } else if (cmd === "q") {
        clearTimeout(timer)
        rl.close()
        process.exit(0)
      } else if (cmd === "?") {
        console.log("commands:")
        console.log("  r  refresh now")
        console.log("  q  quit")
        console.log("  ?  show this help")
      }
    })
    rl.on("close", () => {
      clearTimeout(timer)
      finish()
    })
  })
}
