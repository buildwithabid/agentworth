import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { applyTheme, isDark, readTheme } from '../lib/theme'
import type { ThemeChoice } from '../lib/theme'
import { Avatar } from './ui'
import { IconMoon, IconSignOut, IconSun, NAV_ICON } from './icons'

export const ROUTES = [
  'pipeline',
  'capacity',
  'tasks',
  'ledger',
  'checklist',
  'documents',
  'weekly',
  'team',
] as const
export type Route = (typeof ROUTES)[number]

const LABELS: Record<Route, string> = {
  pipeline: 'Pipeline',
  capacity: 'Capacity',
  tasks: 'Tasks',
  ledger: 'Ledger',
  checklist: 'Checklist',
  documents: 'Documents',
  weekly: 'Weekly',
  team: 'Team',
}

/** The two screens that exist to hold the tension between selling and building. */
const PRIMARY: Route[] = ['pipeline', 'capacity', 'weekly']

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme)
  const dark = isDark(choice)

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  const next = dark ? 'light' : 'dark'
  return (
    <button
      onClick={() => setChoice(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`inline-flex items-center gap-2 rounded-lg text-body transition hover:bg-panel hover:text-ink ${
        compact ? 'p-2' : 'w-full px-2.5 py-2 text-sm'
      }`}
    >
      {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      {!compact && <span>{dark ? 'Light' : 'Dark'}</span>}
    </button>
  )
}

export default function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { me, isAdmin } = useSession()
  const nav = ROUTES.filter((r) => r !== 'team' || isAdmin)

  return (
    <div className="min-h-dvh bg-paper">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* ---- desktop rail ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-rule bg-card/60 px-3 py-5 lg:flex">
        <div className="px-2.5 pb-5">
          <p className="font-serif text-[19px] leading-none tracking-tight">Agentworth</p>
          <p className="mt-1.5 text-[11px] tracking-[0.14em] text-muted uppercase">Internal</p>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          {nav.map((r, i) => {
            const Icon = NAV_ICON[r]
            const active = route === r
            const startsGroup = i > 0 && PRIMARY.includes(nav[i - 1]) && !PRIMARY.includes(r)
            return (
              <a
                key={r}
                href={`#/${r}`}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  startsGroup ? 'mt-2 border-t border-hair pt-3.5' : ''
                } ${
                  active
                    ? 'bg-accent text-accent-ink'
                    : 'text-body hover:bg-panel hover:text-ink'
                }`}
              >
                <Icon size={17} className={active ? '' : 'text-muted group-hover:text-body'} />
                {LABELS[r]}
              </a>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-hair pt-3">
          {me && (
            <div className="mb-1 flex items-center gap-2.5 px-2.5 py-1.5">
              <Avatar name={me.full_name} you />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{me.full_name}</span>
                <span className="block text-[11px] text-muted capitalize">{me.role}</span>
              </span>
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-body transition hover:bg-panel hover:text-ink"
          >
            <IconSignOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ---- mobile bar ---- */}
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/92 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="font-serif text-[17px] tracking-tight">Agentworth</span>
          {me && (
            <span className="ml-auto flex items-center gap-2">
              <Avatar name={me.full_name} you />
              <ThemeToggle compact />
              <button
                onClick={() => supabase.auth.signOut()}
                aria-label="Sign out"
                className="rounded-lg p-2 text-body transition hover:bg-panel hover:text-ink"
              >
                <IconSignOut size={16} />
              </button>
            </span>
          )}
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Sections, compact">
          {nav.map((r) => {
            const Icon = NAV_ICON[r]
            const active = route === r
            return (
              <a
                key={r}
                href={`#/${r}`}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-accent text-accent-ink' : 'text-body hover:bg-panel'
                }`}
              >
                <Icon size={15} />
                {LABELS[r]}
              </a>
            )
          })}
        </nav>
      </header>

      <main id="main" className="lg:pl-[228px]">
        <div className="mx-auto max-w-[1120px] px-4 py-6 pb-20 sm:px-7 sm:py-8">{children}</div>
      </main>
    </div>
  )
}
