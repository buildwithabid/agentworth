import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, Role } from './types'

type SessionValue = {
  session: Session | null
  /** The signed-in user's own profile. Null until it loads. */
  me: Profile | null
  /** Everyone on the team, for owner and assignee pickers. */
  team: Profile[]
  role: Role
  isAdmin: boolean
  isSales: boolean
  ready: boolean
  reloadTeam: () => Promise<void>
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [team, setTeam] = useState<Profile[]>([])
  const [ready, setReady] = useState(false)

  const reloadTeam = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('role').order('full_name')
    setTeam((data ?? []) as Profile[])
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await reloadTeam()
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) void reloadTeam()
      else setTeam([])
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [reloadTeam])

  const value = useMemo<SessionValue>(() => {
    const me = team.find((p) => p.id === session?.user.id) ?? null
    const role: Role = me?.role ?? 'pending'
    return {
      session,
      me,
      team,
      role,
      isAdmin: role === 'admin',
      isSales: role === 'sales',
      ready,
      reloadTeam,
    }
  }, [session, team, ready, reloadTeam])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}

/** Display name for a user id, falling back to something readable. */
export function nameOf(team: Profile[], id: string | null | undefined): string {
  if (!id) return 'Unassigned'
  const p = team.find((t) => t.id === id)
  return p?.full_name || p?.email || 'Unknown'
}
