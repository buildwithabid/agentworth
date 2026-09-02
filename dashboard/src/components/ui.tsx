import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'quiet' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const styles = {
    primary: 'bg-accent text-paper hover:opacity-90',
    quiet: 'bg-panel text-ink border border-rule hover:bg-rule/50',
    danger: 'bg-transparent text-alarm border border-alarm/40 hover:bg-alarm/10',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-body uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-rule bg-white px-3 py-2 text-base text-ink outline-none focus:border-accent'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-paper p-5 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl">{title}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-body hover:bg-panel"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Single horizontal bar. Turns red once value exceeds max. */
export function Bar({ value, max, height = 'h-6' }: { value: number; max: number; height?: string }) {
  const over = value > max
  const scale = Math.max(max, value, 1)
  const pct = (value / scale) * 100
  const capPct = (max / scale) * 100
  return (
    <div className={`relative w-full overflow-hidden rounded bg-panel ${height}`}>
      <div
        className={`h-full ${over ? 'bg-alarm' : 'bg-accent'}`}
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

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-alarm/40 bg-alarm/10 px-4 py-3 text-sm text-alarm">
      {message}
    </div>
  )
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-body">Loading…</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-body">{children}</p>
}
