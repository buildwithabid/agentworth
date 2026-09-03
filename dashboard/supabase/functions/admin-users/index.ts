/**
 * Admin-only account control.
 *
 * The service-role key can create, suspend and delete accounts. It must never
 * reach the browser, so it lives here: the function runtime is given it by
 * Supabase, and every request is checked against the caller's own JWT before
 * anything happens. A sales user calling this gets 403 no matter what they put
 * in the body — the role is read from the database, never taken from the
 * request.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Permanent for practical purposes; 'none' lifts it. */
const BAN_FOREVER = '876000h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const service = createClient(URL_, SERVICE, { auth: { persistSession: false } })

  // ---- who is asking? ----
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(URL_, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const {
    data: { user },
  } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return json({ error: 'Admins only' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }
  const action = String(body.action ?? '')
  const targetId = body.user_id ? String(body.user_id) : ''

  /** Guards that apply to anything touching an existing account. */
  const guardTarget = async (): Promise<string | null> => {
    if (!targetId) return 'No account given'
    if (targetId === user.id) return 'You cannot do that to your own account'
    const { data: target } = await service
      .from('profiles')
      .select('role')
      .eq('id', targetId)
      .single()
    if (!target) return 'That account no longer exists'
    if (target.role === 'admin') {
      const { count } = await service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
      if ((count ?? 0) <= 1) return 'That is the only admin left'
    }
    return null
  }

  try {
    switch (action) {
      /* ---- who exists, and when were they last here ---- */
      case 'list_users': {
        const { data, error } = await service.auth.admin.listUsers({ perPage: 200 })
        if (error) throw error
        return json({
          users: data.users.map((u) => ({
            id: u.id,
            email: u.email,
            last_sign_in_at: u.last_sign_in_at,
            banned_until: (u as { banned_until?: string }).banned_until ?? null,
            created_at: u.created_at,
          })),
        })
      }

      /* ---- invite and create in one step ---- */
      case 'create_user': {
        const email = String(body.email ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        const fullName = String(body.full_name ?? '').trim()
        const role = String(body.role ?? 'sales')
        if (!email || password.length < 8)
          return json({ error: 'Need an email and a password of at least 8 characters' }, 400)
        if (!['admin', 'sales', 'pending'].includes(role))
          return json({ error: 'Unknown role' }, 400)

        // the signup trigger refuses anyone not invited, so invite first
        await service
          .from('allowed_signups')
          .upsert({ email, note: fullName || null, invited_by: user.id }, { onConflict: 'email' })

        const { data: created, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (error) return json({ error: error.message }, 400)

        await service
          .from('profiles')
          .update({ role, full_name: fullName || email.split('@')[0] })
          .eq('id', created.user.id)

        return json({ ok: true, user_id: created.user.id })
      }

      /* ---- set someone's password ---- */
      case 'set_password': {
        const password = String(body.password ?? '')
        if (password.length < 8)
          return json({ error: 'Password must be at least 8 characters' }, 400)
        if (!targetId) return json({ error: 'No account given' }, 400)
        // allowed on your own account too, so this doubles as "change mine"
        const { error } = await service.auth.admin.updateUserById(targetId, { password })
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true })
      }

      /* ---- cut someone off now, or let them back in ---- */
      case 'set_suspended': {
        const suspended = body.suspended === true
        const problem = await guardTarget()
        if (problem) return json({ error: problem }, 400)
        const { error } = await service.auth.admin.updateUserById(targetId, {
          ban_duration: suspended ? BAN_FOREVER : 'none',
        })
        if (error) return json({ error: error.message }, 400)
        if (suspended) await service.from('profiles').update({ role: 'pending' }).eq('id', targetId)
        return json({ ok: true })
      }

      /* ---- remove an account entirely ---- */
      case 'delete_user': {
        const problem = await guardTarget()
        if (problem) return json({ error: problem }, 400)

        // Deals are the business's (clause 7), so they are handed on rather
        // than deleted with the person.
        const { count: dealCount } = await service
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', targetId)

        if ((dealCount ?? 0) > 0) {
          const reassignTo = body.reassign_to ? String(body.reassign_to) : ''
          if (!reassignTo)
            return json(
              {
                error: `They still own ${dealCount} ${
                  dealCount === 1 ? 'deal' : 'deals'
                }. Choose who takes them over.`,
                needs_reassign: true,
                deal_count: dealCount,
              },
              409,
            )
          const { error: moveErr } = await service
            .from('deals')
            .update({ owner_id: reassignTo })
            .eq('owner_id', targetId)
          if (moveErr) return json({ error: moveErr.message }, 400)
        }

        const { error } = await service.auth.admin.deleteUser(targetId)
        if (error) return json({ error: error.message }, 400)
        return json({ ok: true, reassigned: dealCount ?? 0 })
      }

      default:
        return json({ error: `Unknown action "${action}"` }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
