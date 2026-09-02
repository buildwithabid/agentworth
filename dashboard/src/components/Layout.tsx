import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Route = 'pipeline' | 'capacity'

const NAV: { route: Route; label: string }[] = [
  { route: 'pipeline', label: 'Pipeline' },
  { route: 'capacity', label: 'Capacity' },
]

export default function Layout({
  route,
  email,
  children,
}: {
  route: Route
  email: string
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-serif text-lg">Agentworth</span>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <a
                key={n.route}
                href={`#/${n.route}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  route === n.route ? 'bg-accent text-paper' : 'text-body hover:bg-panel'
                }`}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-body sm:inline">{email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-body underline underline-offset-2 hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
