import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Avatar, Badge } from './ui'

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

export default function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { me, isAdmin } = useSession()
  const nav = ROUTES.filter((r) => r !== 'team' || isAdmin)

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <span className="font-serif text-lg tracking-tight">Agentworth</span>
          <span className="hidden text-[11px] text-muted sm:inline">internal</span>

          <div className="ml-auto flex items-center gap-2.5">
            {me && (
              <span className="hidden items-center gap-2 sm:flex">
                <Avatar name={me.full_name} you />
                <span className="text-xs text-body">{me.full_name}</span>
                <Badge tone={isAdmin ? 'accent' : 'neutral'}>{me.role}</Badge>
              </span>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md px-2 py-1 text-xs text-body transition hover:bg-panel hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((r) => (
            <a
              key={r}
              href={`#/${r}`}
              aria-current={route === r ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                route === r
                  ? 'bg-accent text-paper'
                  : 'text-body hover:bg-panel hover:text-ink'
              }`}
            >
              {LABELS[r]}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-16">{children}</main>
    </div>
  )
}
