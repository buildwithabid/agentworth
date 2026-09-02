export function usd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function hours(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`
}

/** "12 Mar" — short, unambiguous, no year unless it differs from today. */
export function shortDate(iso: string): string {
  const d = parseDate(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Parse a YYYY-MM-DD string as a local date (midday, so timezones can't shift it). */
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
