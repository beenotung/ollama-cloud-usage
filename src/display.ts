import { SESSION_MS, WEEKLY_MS } from "./reset"

const GREEN = "\x1b[32m"
const ORANGE = "\x1b[33m"
const RED = "\x1b[31m"
const RESET = "\x1b[0m"

function rateColor(rate: number | null): string {
  if (rate === null) return ""
  if (rate > 1) return RED
  if (rate > 0.8) return ORANGE
  return GREEN
}

function bar(length: number, percent: number): string {
  let filled = Math.round((length * percent) / 100)
  return "█".repeat(filled) + "░".repeat(length - filled)
}

function countdown(ms: number): string {
  let s = Math.round(ms / 1000)
  let m = Math.floor(s / 60)
  let h = Math.floor(m / 60)
  let days = Math.floor(h / 24)
  if (days >= 1) return `${days}d ${h % 24}h`
  if (h >= 1) return `${h}h ${m % 60}m`
  if (m >= 1) return `${m}m ${s % 60}s`
  return `${s}s`
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export interface StatusInput {
  sessionUsage: number // 0-100
  weeklyUsage: number // 0-100
  sessionReset: Date | null
  weeklyReset: Date
  now: Date
}

export function printStatus(input: StatusInput): void {
  let { sessionUsage: sp, weeklyUsage: wp, sessionReset, weeklyReset, now } = input

  let sLine = sessionReset
    ? `reset in ${countdown(sessionReset.getTime() - now.getTime())} (${hhmm(sessionReset)})`
    : "observing first reset…"
  let wLine = `reset in ${countdown(weeklyReset.getTime() - now.getTime())} (${weeklyReset.toDateString().slice(0, 3)} ${hhmm(weeklyReset)})`

  // time elapsed within each window
  let sElapsed = sessionReset
    ? Math.min(100, Math.max(0, ((now.getTime() - (sessionReset.getTime() - SESSION_MS)) / SESSION_MS) * 100))
    : null
  let wElapsed = Math.min(100, Math.max(0, ((now.getTime() - (weeklyReset.getTime() - WEEKLY_MS)) / WEEKLY_MS) * 100))

  // burn rate = usage% / elapsed% (1.0x = on track to hit 100% at reset)
  let sRate = sElapsed ? sp / sElapsed : null
  let wRate = wElapsed ? wp / wElapsed : null

  console.log(`[${hhmm(now)}] 5H:${sp.toFixed(1)}% W:${wp.toFixed(1)}%`)
  console.log(`  ${"5-hour".padEnd(6)}  ${bar(18, sp)}  ${sp.toFixed(1).padStart(5)}% ${"used".padEnd(7)}   rate ${rateColor(sRate)}${sRate ? sRate.toFixed(1) + "x" : "?"}${RESET}`)
  if (sElapsed !== null) console.log(`  ${"time".padEnd(6)}  ${bar(18, sElapsed)}  ${sElapsed.toFixed(1).padStart(5)}% ${"elapsed".padEnd(7)}   ${sLine}`)
  console.log("")
  console.log(`  ${"Weekly".padEnd(6)}  ${bar(18, wp)}  ${wp.toFixed(1).padStart(5)}% ${"used".padEnd(7)}   rate ${rateColor(wRate)}${wRate ? wRate.toFixed(1) + "x" : "?"}${RESET}`)
  console.log(`  ${"time".padEnd(6)}  ${bar(18, wElapsed)}  ${wElapsed.toFixed(1).padStart(5)}% ${"elapsed".padEnd(7)}   ${wLine}`)
}
