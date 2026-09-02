import type { Project } from './types'
import { parseDate, toISODate } from './format'

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  const shift = (out.getDay() + 6) % 7 // Mon = 0
  out.setDate(out.getDate() - shift)
  return out
}

export function addWeeks(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n * 7)
  return out
}

export type Week = { start: string; end: string }

export function weekOf(d: Date): Week {
  const s = weekStart(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return { start: toISODate(s), end: toISODate(e) }
}

/** Weeks from the current week forward, inclusive. */
export function nextWeeks(count: number): Week[] {
  const s = weekStart(new Date())
  return Array.from({ length: count }, (_, i) => weekOf(addWeeks(s, i)))
}

export function isRunningInWeek(p: Project, week: Week): boolean {
  if (p.status !== 'active') return false
  if (p.start_date > week.end) return false
  if (p.end_date && p.end_date < week.start) return false
  return true
}

/** Committed billable hours for a given week. */
export function committedInWeek(projects: Project[], week: Week): number {
  return projects
    .filter((p) => isRunningInWeek(p, week))
    .reduce((sum, p) => sum + Number(p.est_hours_per_week), 0)
}

export type FreeWeek = { week: Week; free: number; weeksAway: number }

/**
 * First week in the horizon where committed hours are under the cap.
 * Returns null when we are full for the whole horizon — which is the answer
 * sales needs before promising a start date.
 */
export function earliestFreeWeek(
  projects: Project[],
  cap: number,
  horizonWeeks = 26,
): FreeWeek | null {
  const weeks = nextWeeks(horizonWeeks)
  for (let i = 0; i < weeks.length; i++) {
    const free = cap - committedInWeek(projects, weeks[i])
    if (free > 0) return { week: weeks[i], free, weeksAway: i }
  }
  return null
}

/** Human label for a week: "this week", "next week (7 Sep)", "week of 14 Apr". */
export function weekLabel(week: Week, weeksAway: number): string {
  const date = parseDate(week.start).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
  if (weeksAway === 0) return 'this week'
  if (weeksAway === 1) return `next week (${date})`
  return `week of ${date}`
}
