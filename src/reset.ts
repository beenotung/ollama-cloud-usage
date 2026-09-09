// Reset schedule (confirmed from real usage data):
//   - Weekly: fixed, Monday 00:00 UTC
//   - Session: rolling 5-hour window, chained from the last observed reset.
//     There is no fixed grid (24h is not divisible by 5h), so the anchor
//     drifts through the day. On a fresh env with no history we bootstrap by
//     observing the first reset, then predict every subsequent one as
//     lastReset + 5h.

export const SESSION_MS = 5 * 3600_000
export const WEEKLY_MS = 7 * 24 * 3600_000

// Next weekly reset: Monday 00:00 UTC.
export function nextWeeklyReset(now: Date): Date {
  let d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  let diff = (1 - d.getUTCDay() + 7) % 7 // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff)
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 7)
  return d
}

// Next session reset: lastReset + 5h. Returns null until a reset is observed.
export function nextSessionReset(now: Date, lastReset: Date | null): Date | null {
  if (!lastReset) return null
  let next = new Date(lastReset.getTime() + SESSION_MS)
  return next > now ? next : null
}
