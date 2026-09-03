import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllowedSignups, fetchDeals } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { AllowedSignup, Deal, Profile, Role } from '../lib/types'
import { shortDate } from '../lib/format'
import {
  Alarm,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'

const ROLE_NOTE: Record<Role, string> = {
  admin: 'Everything: the cap, projects, the ledger, every deal, the checklist, roles and invites.',
  sales: 'Their own deals. Reads the whole pipeline, the ledger and capacity; changes none of them.',
  pending: 'Signed in but sees nothing. This is what revoked access looks like.',
}

export default function Team() {
  const { team, me, reloadTeam } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [invites, setInvites] = useState<AllowedSignup[] | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [handover, setHandover] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([fetchAllowedSignups(), fetchDeals()])
      setInvites(a)
      setDeals(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const admins = team.filter((p) => p.role === 'admin').length
  const dealsOwnedBy = (id: string) => deals.filter((d) => d.owner_id === id).length

  async function setRole(p: Profile, role: Role) {
    setBusy(p.id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    setBusy(null)
    if (error) toast.bad(error.message)
    else {
      toast.ok(
        role === 'pending'
          ? `${p.full_name} can no longer see anything`
          : `${p.full_name} is now ${role}`,
      )
      await reloadTeam()
    }
  }

  async function removeInvite(email: string) {
    const { error } = await supabase.from('allowed_signups').delete().eq('email', email)
    if (error) toast.bad(error.message)
    else {
      toast.ok(`${email} can no longer register`)
      void load()
    }
  }

  if (error && !invites) return <ErrorBanner message={error} />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Team"
        subtitle="Who can get in, and what they can do once they are. Enforced by the database, not by hiding buttons."
      />

      <div className="space-y-3">
        {team.map((p) => {
          const isMe = p.id === me?.id
          const lastAdmin = p.role === 'admin' && admins <= 1
          const owned = dealsOwnedBy(p.id)
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={p.full_name} you={isMe} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.full_name}
                    {isMe && <span className="text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={p.role === 'admin' ? 'accent' : p.role === 'sales' ? 'neutral' : 'warn'}
                  >
                    {p.role}
                  </Badge>
                  <Select
                    value={p.role}
                    disabled={busy === p.id || lastAdmin}
                    title={lastAdmin ? 'You cannot remove the only admin' : undefined}
                    onChange={(e) => void setRole(p, e.target.value as Role)}
                    className="w-32"
                  >
                    <option value="admin">admin</option>
                    <option value="sales">sales</option>
                    <option value="pending">pending</option>
                  </Select>
                </div>
              </div>

              <p className="mt-2.5 text-xs text-body">{ROLE_NOTE[p.role]}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
                <span className="text-[11px] text-muted">
                  Added {shortDate(p.created_at.slice(0, 10))}
                  {owned > 0 && ` · owns ${owned} ${owned === 1 ? 'deal' : 'deals'}`}
                </span>
                {owned > 0 && !isMe && (
                  <Button
                    size="sm"
                    variant="quiet"
                    className="ml-auto"
                    onClick={() => setHandover(p)}
                  >
                    Hand over their pipeline
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* ---- who may register at all ---- */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl">Who may register</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-body">
              Sign-up is invite-only, refused by the database itself. An address that is not on this
              list cannot create an account, whoever tries and whichever route they use.
            </p>
          </div>
          <Button onClick={() => setInviting(true)} icon={<IconPlus size={15} />}>
            Invite an address
          </Button>
        </div>

        <Card tone="quiet">
          {invites === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <ul className="divide-y divide-hair">
              {invites.map((a) => {
                const hasAccount = team.some((p) => p.email.toLowerCase() === a.email)
                return (
                  <li key={a.email} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.email}</span>
                      {a.note && <span className="block text-xs text-muted">{a.note}</span>}
                    </span>
                    {hasAccount ? (
                      <Badge tone="accent">has an account</Badge>
                    ) : (
                      <Badge tone="warn">invited, not registered</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void removeInvite(a.email)}
                      icon={<IconTrash size={13} />}
                      disabled={hasAccount}
                      disabledReason="Remove their access with the role dropdown first"
                    >
                      <span className="sr-only sm:not-sr-only">Remove</span>
                    </Button>
                  </li>
                )
              })}
              {invites.length === 0 && (
                <li className="py-2 text-sm text-muted">Nobody is invited. Nobody can register.</li>
              )}
            </ul>
          )}
        </Card>
      </section>

      {/* ---- what still needs the Supabase console ---- */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">Passwords and permanent removal</h2>
        <Alarm tone="warn" title="These two live in the Supabase console, not here">
          <p className="text-sm">
            Setting someone's password and deleting an account outright need the service key, which
            must never be shipped to a browser. Both are done from{' '}
            <span className="font-medium">Authentication → Users</span> in the Supabase dashboard.
          </p>
          <p className="mt-2 text-sm">
            Setting a member to <span className="font-medium">pending</span> above is the immediate
            control: they keep an account but every table refuses them from that moment. Nothing
            they entered is deleted.
          </p>
        </Alarm>
      </section>

      {inviting && (
        <InviteForm
          onClose={() => setInviting(false)}
          onSaved={() => {
            setInviting(false)
            toast.ok('Invited')
            void load()
          }}
        />
      )}

      {handover && (
        <HandoverForm
          from={handover}
          count={dealsOwnedBy(handover.id)}
          onClose={() => setHandover(null)}
          onDone={(msg) => {
            setHandover(null)
            toast.ok(msg)
            void load()
          }}
        />
      )}
    </div>
  )
}

function InviteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { me } = useSession()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('allowed_signups').insert({
      email: email.trim().toLowerCase(),
      note: note.trim() || null,
      invited_by: me?.id ?? null,
    })
    setBusy(false)
    if (error) toast.bad(error.message)
    else onSaved()
  }

  return (
    <Modal
      title="Invite an address"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="submit" form="invite-form" disabled={busy}>
            {busy ? 'Saving…' : 'Add to the list'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="invite-form" onSubmit={save} className="space-y-4">
        <Field label="Email" hint="Must match the address they will sign up with, exactly.">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            placeholder="name@example.com"
          />
        </Field>
        <Field label="Note" hint="Optional — who they are, so the list stays readable.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">
          This only permits the address to register. They still land as{' '}
          <span className="font-medium">pending</span> with access to nothing until you give them a
          role.
        </p>
      </form>
    </Modal>
  )
}

function HandoverForm({
  from,
  count,
  onClose,
  onDone,
}: {
  from: Profile
  count: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { team } = useSession()
  const toast = useToast()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = team.filter((p) => p.id !== from.id && p.role !== 'pending')

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!to) return
    setBusy(true)
    const { error } = await supabase.from('deals').update({ owner_id: to }).eq('owner_id', from.id)
    setBusy(false)
    if (error) toast.bad(error.message)
    else onDone(`${count} ${count === 1 ? 'deal' : 'deals'} moved to ${nameOf(team, to)}`)
  }

  return (
    <Modal
      title="Hand over the pipeline"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="submit" form="handover-form" disabled={busy || !to}>
            {busy ? 'Moving…' : `Move ${count} ${count === 1 ? 'deal' : 'deals'}`}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="handover-form" onSubmit={run} className="space-y-4">
        <p className="text-sm text-body">
          Clause 7 of the agreement makes leads the business's, not the founder's. This moves every
          deal {from.full_name} owns to someone else — the record of who closed what is unaffected.
        </p>
        <Field label="Hand to">
          <Select value={to} onChange={(e) => setTo(e.target.value)} required autoFocus>
            <option value="">Choose a founder…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
