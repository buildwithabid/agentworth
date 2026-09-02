import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { initials } from '../lib/format'

/* ---------------------------------------------------------------- toasts */

type Toast = { id: number; kind: 'ok' | 'bad'; text: string }
type ToastApi = { ok: (t: string) => void; bad: (t: string) => void }

const ToastCtx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = next.current++
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'bad' ? 6000 : 2600)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({ ok: (t) => push('ok', t), bad: (t) => push('bad', t) }),
    [push],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              t.kind === 'ok' ? 'bg-ink text-paper' : 'bg-alarm text-white'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast must be used inside ToastProvider')
  return v
}

/* --------------------------------------------------------------- buttons */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'quiet' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  /** Shown as a tooltip and screen-reader hint when disabled by permissions. */
  disabledReason?: string
  /** id of a form elsewhere in the DOM, so footer buttons can submit it. */
  form?: string
  className?: string
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled,
  disabledReason,
  form,
  className = '',
}: ButtonProps) {
  const styles = {
    primary: 'bg-accent text-paper hover:bg-accent/90 shadow-sm',
    quiet: 'bg-white text-ink border border-rule hover:border-body/40 hover:bg-panel',
    ghost: 'text-body hover:bg-panel hover:text-ink',
    danger: 'text-alarm border border-alarm/35 hover:bg-alarm/10',
  }[variant]
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={disabled && disabledReason ? disabledReason : undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${pad} ${className}`}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- inputs */

const field =
  'w-full rounded-lg border border-rule bg-white px-3 py-2 text-base text-ink transition placeholder:text-muted hover:border-body/40 focus:border-accent focus:outline-none disabled:bg-panel disabled:text-muted'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-body uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${props.className ?? ''}`} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${field} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${field} ${props.className ?? ''}`} />
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  disabledReason,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
  disabledReason?: string
}) {
  return (
    <label
      className={`flex items-start gap-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      title={disabled ? disabledReason : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#1f4d3f] disabled:opacity-40"
      />
      <span className={disabled ? 'text-muted' : ''}>{label}</span>
    </label>
  )
}

/* --------------------------------------------------------------- surfaces */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return (
    <Tag className={`rounded-xl border border-rule bg-white p-4 sm:p-5 ${className}`}>
      {children}
    </Tag>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-sm text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{children}</p>
  )
}

export function Stat({
  label,
  value,
  detail,
  tone = 'normal',
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'normal' | 'alarm' | 'good'
}) {
  const colour =
    tone === 'alarm' ? 'text-alarm' : tone === 'good' ? 'text-accent' : 'text-ink'
  return (
    <div>
      <Label>{label}</Label>
      <p className={`tnum mt-1 font-serif text-2xl leading-none ${colour}`}>{value}</p>
      {detail && <p className="mt-1.5 text-xs text-body">{detail}</p>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'alarm' | 'warn' | 'muted'
}) {
  const styles = {
    neutral: 'bg-panel text-body',
    accent: 'bg-accent/10 text-accent',
    alarm: 'bg-alarm/10 text-alarm',
    warn: 'bg-warn/10 text-warn',
    muted: 'bg-panel text-muted',
  }[tone]
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${styles}`}
    >
      {children}
    </span>
  )
}

export function Avatar({ name, you = false }: { name: string; you?: boolean }) {
  return (
    <span
      title={name}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
        you ? 'bg-accent text-paper' : 'bg-sunk text-body'
      }`}
    >
      {initials(name)}
    </span>
  )
}

/** Single horizontal bar. Turns red once value exceeds max. */
export function Bar({
  value,
  max,
  height = 'h-6',
}: {
  value: number
  max: number
  height?: string
}) {
  const over = value > max
  const scale = Math.max(max, value, 1)
  const pct = (value / scale) * 100
  const capPct = (max / scale) * 100
  return (
    <div className={`relative w-full overflow-hidden rounded-md bg-sunk ${height}`}>
      <div
        className={`h-full transition-[width] duration-300 ${over ? 'bg-alarm' : 'bg-accent'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      {over && (
        <div
          className="absolute inset-y-0 w-0.5 bg-ink/60"
          style={{ left: `${capPct}%` }}
          title="cap"
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- modal */

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="animate-rise flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-paper shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-body transition hover:bg-panel hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-rule px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- states */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-sunk ${className}`} />
}

export function LoadingScreen() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-52" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-alarm/40 bg-alarm/10 px-4 py-3 text-sm text-alarm">
      {message}
    </div>
  )
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-rule px-6 py-10 text-center">
      <p className="font-medium text-body">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** A read-only notice for people whose role does not allow editing here. */
export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 rounded-lg border border-rule bg-panel px-3.5 py-2.5 text-xs text-body">
      {children}
    </p>
  )
}
