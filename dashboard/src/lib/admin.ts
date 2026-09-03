import { supabase } from './supabase'
import type { Role } from './types'

/**
 * Account control that needs the service-role key, which must never ship in a
 * browser bundle. These go to the `admin-users` Edge Function, which reads the
 * caller's own JWT, looks their role up in the database and refuses anyone who
 * is not an admin — so the check does not depend on this file being honest.
 */

export type AuthAccount = {
  id: string
  email: string | null
  last_sign_in_at: string | null
  banned_until: string | null
  created_at: string
}

type Result<T> = { data: T | null; error: string | null; needsReassign?: boolean }

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // the function replies with a readable message; surface that, not "500"
    let message = error.message
    let needsReassign = false
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        const parsed = await ctx.json()
        if (parsed?.error) message = parsed.error
        needsReassign = parsed?.needs_reassign === true
      } catch {
        /* keep the original message */
      }
    }
    return { data: null, error: message, needsReassign }
  }
  return { data: data as T, error: null }
}

export const listAccounts = () => call<{ users: AuthAccount[] }>({ action: 'list_users' })

export const createAccount = (input: {
  email: string
  password: string
  full_name: string
  role: Role
}) => call<{ ok: true; user_id: string }>({ action: 'create_user', ...input })

export const setPassword = (userId: string, password: string) =>
  call<{ ok: true }>({ action: 'set_password', user_id: userId, password })

export const setSuspended = (userId: string, suspended: boolean) =>
  call<{ ok: true }>({ action: 'set_suspended', user_id: userId, suspended })

export const deleteAccount = (userId: string, reassignTo?: string) =>
  call<{ ok: true; reassigned: number }>({
    action: 'delete_user',
    user_id: userId,
    ...(reassignTo ? { reassign_to: reassignTo } : {}),
  })

/** Banned-until dates are set far in the future, so any future date means suspended. */
export function isSuspended(a: AuthAccount | undefined): boolean {
  if (!a?.banned_until) return false
  return new Date(a.banned_until).getTime() > Date.now()
}
