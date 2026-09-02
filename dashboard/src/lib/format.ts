import type { Currency } from './types'

export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function money(n: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PKR' ? 0 : 2,
  }).format(n)
}

export function hours(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`
}

/** "12 Mar" — short, with the year only when it isn't the current one. */
export function shortDate(iso: string): string {
  const d = parseDate(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** "3 days ago", "in 2 days", "today". */
export function relativeDay(iso: string): string {
  const days = Math.round(
    (parseDate(iso).getTime() - parseDate(today()).getTime()) / 86_400_000,
  )
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} days ago`
  return `in ${days} days`
}

/** Parse YYYY-MM-DD as a local date at midday, so time zones cannot shift it. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseDate(toISO).getTime() - parseDate(fromISO).getTime()) / 86_400_000)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export function fileSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
