import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactElement, ReactNode } from 'react'
import { initials } from '../lib/format'
import { IconAlert, IconCheck, IconClose } from './icons'

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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'bad' ? 6500 : 2800)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({ ok: (t) => push('ok', t), bad: (t) => push('bad', t) }),
    [push],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-slide pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm shadow-pop ${
              t.kind === 'ok'
                ? 'bg-ink text-paper'
                : 'bg-alarm text-white'
            }`}
          >
            {t.kind === 'ok' ? <IconCheck size={15} /> : <IconAlert size={15} />}
            <span>{t.text}</span>
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
  icon?: ReactNode
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
  icon,
  className = '',
}: ButtonProps) {
  const styles = {
    primary:
      'bg-accent text-accent-ink shadow-card hover:brightness-110 active:brightness-95',
    quiet:
      'bg-card text-ink border border-rule shadow-card hover:border-body/40 hover:bg-panel',
    ghost: 'text-body hover:bg-panel hover:text-ink',
    danger: 'text-alarm border border-alarm/30 hover:bg-alarm/10 hover:border-alarm/50',
  }[variant]
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs gap-1.5' : 'px-3.5 py-2 text-sm gap-2'
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={disabled && disabledReason ? disabledReason : undefined}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${styles} ${pad} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- inputs */

const field =
  'w-full rounded-lg border border-rule bg-card px-3 py-2 text-base text-ink transition placeholder:text-muted hover:border-body/40 focus:border-accent focus:outline-none disabled:bg-panel disabled:text-muted'

/**
 * The hint sits outside the <label> and is wired with aria-describedby. Inside
 * it, the hint becomes part of the control's accessible name — a screen reader
 * would announce the whole sentence as the field's name.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  const base = useId()
  const controlId = `${base}-control`
  const hintId = hint ? `${base}-hint` : undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? controlId,
        'aria-describedby':
          [hintId, (children.props as { 'aria-describedby'?: string })['aria-describedby']]
            .filter(Boolean)
            .join(' ') || undefined,
      })
    : children

  return (
    <div className="block">
      <label
        htmlFor={controlId}
        className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-body uppercase"
      >
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
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

/* --------------------------------------------------------------- surfaces */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
  tone = 'raised',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
  /** raised = white surface; quiet = filled panel, for supporting blocks. */
  tone?: 'raised' | 'quiet'
}) {
  const skin =
    tone === 'quiet'
      ? 'bg-panel border border-hair'
      : 'bg-card border border-rule shadow-card'
  return <Tag className={`rounded-xl p-4 sm:p-5 ${skin} ${className}`}>{children}</Tag>
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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-serif text-[26px] leading-[1.1] tracking-[-0.015em] text-balance sm:text-[32px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-[62ch] text-sm text-body">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.09em] text-muted uppercase">{children}</p>
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
  const colour = tone === 'alarm' ? 'text-alarm' : tone === 'good' ? 'text-good' : 'text-ink'
  return (
    <div>
      <Label>{label}</Label>
      <p className={`tnum mt-1.5 font-serif text-[28px] leading-none tracking-[-0.01em] ${colour}`}>
        {value}
      </p>
      {detail && <p className="mt-2 text-xs text-body">{detail}</p>}
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
    accent: 'bg-accent/12 text-accent',
    alarm: 'bg-alarm/12 text-alarm',
    warn: 'bg-warn/12 text-warn',
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
        you ? 'bg-accent text-accent-ink' : 'bg-sunk text-body'
      }`}
    >
      {initials(name)}
    </span>
  )
}

/** Horizontal bar. Turns red once value exceeds max, with the cap marked. */
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
        className={`h-full rounded-md transition-[width] duration-500 ease-out ${
          over ? 'bg-alarm' : 'bg-accent'
        }`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      {over && (
        <div
          className="absolute inset-y-0 w-px bg-paper/70"
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
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)

    focusables()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // keep tabbing inside the dialog while it is open
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      returnTo.current?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        className="animate-slide flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-rule bg-paper shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-lg tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-body transition hover:bg-panel hover:text-ink"
            aria-label="Close"
          >
            <IconClose size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-rule px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- states */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-sunk ${className}`} />
}

export function LoadingScreen() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-alarm/35 bg-alarm/10 px-4 py-3 text-sm text-alarm">
      <IconAlert size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
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
    <div className="rounded-xl border border-dashed border-rule px-6 py-12 text-center">
      <p className="font-medium text-body">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** A read-only notice for people whose role does not allow editing here. */
export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 rounded-xl border border-hair bg-panel px-4 py-2.5 text-xs text-body">
      {children}
    </p>
  )
}

/** Alert block used for the loud, business-critical warnings. */
export function Alarm({
  title,
  children,
  tone = 'alarm',
}: {
  title: ReactNode
  children?: ReactNode
  tone?: 'alarm' | 'warn'
}) {
  const skin =
    tone === 'alarm'
      ? 'border-alarm/50 bg-alarm/10 text-alarm'
      : 'border-warn/45 bg-warn/10 text-warn'
  return (
    <div className={`mb-4 rounded-xl border-l-[3px] px-4 py-3.5 ${skin}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <IconAlert size={16} className="shrink-0" />
        {title}
      </p>
      {children && <div className="mt-2 text-ink">{children}</div>}
    </div>
  )
}
