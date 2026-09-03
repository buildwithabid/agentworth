import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllowedSignups, fetchDeals } from '../lib/data'
import {
  createAccount,
  deleteAccount,
  isSuspended,
  listAccounts,
  setPassword,
  setSuspended,
} from '../lib/admin'
import type { AuthAccount } from '../lib/admin'
import { nameOf, useSession } from '../lib/session'
import type { AllowedSignup, Deal, Profile, Role } from '../lib/types'
import { relativeDay, shortDate } from '../lib/format'
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
  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [adding, setAdding] = useState(false)
  const [passwordFor, setPasswordFor] = useState<Profile | null>(null)
  const [removing, setRemoving] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, d, accts] = await Promise.all([
        fetchAllowedSignups(),
        fetchDeals(),
        listAccounts(),
      ])
      setInvites(a)
      setDeals(d)
      setAccounts(accts.data?.users ?? [])
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

  async function toggleSuspended(p: Profile, suspend: boolean) {
    setBusy(p.id)
    const { error } = await setSuspended(p.id, suspend)
    setBusy(null)
    if (error) toast.bad(error)
    else {
      toast.ok(suspend ? `${p.full_name} is locked out` : `${p.full_name} can sign in again`)
      await reloadTeam()
      void load()
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
        actions={
          <Button onClick={() => setAdding(true)} icon={<IconPlus size={15} />}>
            Add a founder
          </Button>
        }
      />

      <div className="space-y-3">
        {team.map((p) => {
          const isMe = p.id === me?.id
          const lastAdmin = p.role === 'admin' && admins <= 1
          const owned = dealsOwnedBy(p.id)
          const account = accounts.find((a) => a.id === p.id)
          const suspended = isSuspended(account)
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

              {suspended && (
                <p className="mt-2 text-xs font-semibold text-alarm">
                  Suspended — they cannot sign in at all.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hair pt-3">
                <span className="text-[11px] text-muted">
                  Added {shortDate(p.created_at.slice(0, 10))}
                  {account?.last_sign_in_at
                    ? ` · last here ${relativeDay(account.last_sign_in_at.slice(0, 10))}`
                    : ' · never signed in'}
                  {owned > 0 && ` · owns ${owned} ${owned === 1 ? 'deal' : 'deals'}`}
                </span>

                <span className="ml-auto flex flex-wrap gap-2">
                  {owned > 0 && !isMe && (
                    <Button size="sm" variant="quiet" onClick={() => setHandover(p)}>
                      Hand over pipeline
                    </Button>
                  )}
                  <Button size="sm" variant="quiet" onClick={() => setPasswordFor(p)}>
                    Set password
                  </Button>
                  {!isMe && (
                    <Button
                      size="sm"
                      variant="quiet"
                      disabled={busy === p.id || lastAdmin}
                      disabledReason={lastAdmin ? 'You cannot suspend the only admin' : undefined}
                      onClick={() => void toggleSuspended(p, !suspended)}
                    >
                      {suspended ? 'Restore access' : 'Suspend'}
                    </Button>
                  )}
                  {!isMe && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={lastAdmin}
                      disabledReason={lastAdmin ? 'You cannot remove the only admin' : undefined}
                      onClick={() => setRemoving(p)}
                      icon={<IconTrash size={13} />}
                    >
                      Remove
                    </Button>
                  )}
                </span>
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

      {/* ---- what each control actually does ---- */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl">What each control does</h2>
        <Card tone="quiet">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Pending</dt>
              <dd className="text-body">
                Keeps their account and their sign-in, but every table refuses them from that
                moment. Reversible, and nothing they entered is deleted.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Suspend</dt>
              <dd className="text-body">
                Harder. They cannot sign in at all, and their role drops to pending. Reversible.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Set password</dt>
              <dd className="text-body">
                Sets it outright — no reset email, which matters because the free tier rate-limits
                mail. Tell them the new one yourself.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Remove</dt>
              <dd className="text-body">
                Deletes the account for good. Refused while they still own deals, so the pipeline is
                handed on rather than lost with them.
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-hair pt-3 text-xs text-muted">
            The last three need the service key, so they run in the `admin-users` Edge Function,
            which checks your role in the database before doing anything. A sales user calling it
            directly is refused.
          </p>
        </Card>
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

      {adding && (
        <AddFounderForm
          onClose={() => setAdding(false)}
          onSaved={async (name) => {
            setAdding(false)
            toast.ok(`${name} can sign in now`)
            await reloadTeam()
            void load()
          }}
        />
      )}

      {passwordFor && (
        <PasswordForm
          person={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => {
            setPasswordFor(null)
            toast.ok('Password set — tell them what it is')
          }}
        />
      )}

      {removing && (
        <RemoveForm
          person={removing}
          owned={dealsOwnedBy(removing.id)}
          onClose={() => setRemoving(null)}
          onDone={async (msg) => {
            setRemoving(null)
            toast.ok(msg)
            await reloadTeam()
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

function AddFounderForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'sales' as Role,
  })
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await createAccount({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      full_name: form.full_name.trim(),
      role: form.role,
    })
    setBusy(false)
    if (error) toast.bad(error)
    else onSaved(form.full_name.trim() || form.email)
  }

  return (
    <Modal
      title="Add a founder"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="submit" form="add-founder" disabled={busy}>
            {busy ? 'Creating…' : 'Create the account'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="add-founder" onSubmit={save} className="space-y-4">
        <Field label="Full name">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="Password" hint="At least 8 characters. Tell them what it is — no email is sent.">
          <Input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={8}
            required
          />
        </Field>
        <Field label="Role">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="sales">sales</option>
            <option value="admin">admin</option>
            <option value="pending">pending — no access yet</option>
          </Select>
        </Field>
        <p className="text-xs text-muted">
          This invites the address and creates the account in one step. They can sign in
          immediately; no confirmation email is involved.
        </p>
      </form>
    </Modal>
  )
}

function PasswordForm({
  person,
  onClose,
  onSaved,
}: {
  person: Profile
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [password, setPasswordValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await setPassword(person.id, password)
    setBusy(false)
    if (error) toast.bad(error)
    else onSaved()
  }

  return (
    <Modal
      title={`Set a password for ${person.full_name}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="submit" form="set-password" disabled={busy}>
            {busy ? 'Setting…' : 'Set it'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="set-password" onSubmit={save} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
        </Field>
        <p className="text-xs text-muted">
          This replaces their password immediately and sends nothing. Tell them what you set, and
          they can change it by asking you again.
        </p>
      </form>
    </Modal>
  )
}

function RemoveForm({
  person,
  owned,
  onClose,
  onDone,
}: {
  person: Profile
  owned: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { team } = useSession()
  const toast = useToast()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = team.filter((p) => p.id !== person.id && p.role !== 'pending')

  async function run() {
    if (owned > 0 && !to) return
    if (!window.confirm(`Delete ${person.full_name}'s account for good? This cannot be undone.`))
      return
    setBusy(true)
    const { error } = await deleteAccount(person.id, to || undefined)
    setBusy(false)
    if (error) toast.bad(error)
    else
      onDone(
        owned > 0
          ? `${person.full_name} removed, ${owned} ${owned === 1 ? 'deal' : 'deals'} handed on`
          : `${person.full_name} removed`,
      )
  }

  return (
    <Modal
      title={`Remove ${person.full_name}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="danger" onClick={run} disabled={busy || (owned > 0 && !to)}>
            {busy ? 'Removing…' : 'Remove for good'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Alarm title="This deletes the account permanently">
          <p className="text-sm">
            They lose their sign-in for good. If you only want to cut off access, close this and use{' '}
            <span className="font-medium">Suspend</span> or set them to{' '}
            <span className="font-medium">pending</span> instead — both are reversible.
          </p>
        </Alarm>

        {owned > 0 ? (
          <>
            <p className="text-sm text-body">
              They own {owned} {owned === 1 ? 'deal' : 'deals'}. Clause 7 makes leads the
              business's, so those move to someone else rather than going with them.
            </p>
            <Field label="Hand their pipeline to">
              <Select value={to} onChange={(e) => setTo(e.target.value)} required>
                <option value="">Choose a founder…</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <p className="text-sm text-body">They own no deals, so nothing needs handing over.</p>
        )}
      </div>
    </Modal>
  )
}
