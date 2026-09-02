import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDeals, fetchProjects, fetchSettings } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { Deal, Profile, Project, Stage } from '../lib/types'
import { OPEN_STAGES, STAGES } from '../lib/types'
import { firstName, shortDate, today, usd } from '../lib/format'
import { earliestFreeWeek, weekLabel } from '../lib/capacity'
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Label,
  LoadingScreen,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

type Draft = {
  id?: string
  company: string
  owner_id: string
  stage: Stage
  value_usd: string
  next_action: string
  next_action_date: string
}

const normalise = (s: string) => s.trim().toLowerCase()

/** Companies being worked by more than one owner at once. Lost deals don't count. */
function contestedCompanies(deals: Deal[]): Map<string, Deal[]> {
  const byCompany = new Map<string, Deal[]>()
  for (const d of deals) {
    if (d.stage === 'Lost') continue
    byCompany.set(d.company_key, [...(byCompany.get(d.company_key) ?? []), d])
  }
  const out = new Map<string, Deal[]>()
  for (const [key, list] of byCompany) {
    if (new Set(list.map((d) => d.owner_id)).size > 1) out.set(key, list)
  }
  return out
}

export default function Pipeline() {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [deals, setDeals] = useState<Deal[] | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [cap, setCap] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [mineOnly, setMineOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      const [d, p, s] = await Promise.all([fetchDeals(), fetchProjects(), fetchSettings()])
      setDeals(d)
      setProjects(p)
      setCap(s.weekly_hours_cap)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const owners = useMemo(
    () => team.filter((p) => p.role === 'sales' || p.role === 'admin'),
    [team],
  )
  const salesOwners = useMemo(() => team.filter((p) => p.role === 'sales'), [team])

  const contested = useMemo(() => contestedCompanies(deals ?? []), [deals])
  const free = useMemo(() => earliestFreeWeek(projects, cap), [projects, cap])

  const totals = useMemo(() => {
    const people = salesOwners.length ? salesOwners : owners
    return people.map((p) => {
      const mine = (deals ?? []).filter((d) => d.owner_id === p.id)
      return {
        person: p,
        open: mine.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value_usd, 0),
        openCount: mine.filter((d) => OPEN_STAGES.includes(d.stage)).length,
        won: mine.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value_usd, 0),
      }
    })
  }, [deals, salesOwners, owners])

  const canEdit = useCallback(
    (d: Deal) => isAdmin || d.owner_id === me?.id,
    [isAdmin, me],
  )

  async function moveStage(deal: Deal, stage: Stage) {
    const before = deals
    setDeals((prev) => (prev ?? []).map((d) => (d.id === deal.id ? { ...d, stage } : d)))
    const { error } = await supabase.from('deals').update({ stage }).eq('id', deal.id)
    if (error) {
      setDeals(before)
      toast.bad(error.message)
    } else {
      toast.ok(`${deal.company} → ${stage}`)
      void load()
    }
  }

  if (error && !deals) return <ErrorBanner message={error} />
  if (!deals) return <LoadingScreen />

  const visible = mineOnly ? deals.filter((d) => d.owner_id === me?.id) : deals

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Pipeline"
        subtitle={
          isAdmin
            ? 'Every deal, both lists. You can edit any of them.'
            : 'Everyone sees the whole pipeline. You can edit the deals you own.'
        }
        actions={
          <Button
            onClick={() =>
              setEditing({
                company: '',
                owner_id: me?.id ?? '',
                stage: 'Lead',
                value_usd: '',
                next_action: '',
                next_action_date: '',
              })
            }
          >
            Add deal
          </Button>
        }
      />

      {contested.size > 0 && (
        <div className="mb-4 rounded-xl border-2 border-alarm bg-alarm/10 p-4">
          <p className="text-sm font-semibold text-alarm">
            ⚠ The same company is being worked by both owners
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {[...contested.values()].map((list) => (
              <li key={list[0].company_key}>
                <span className="font-medium">{list[0].company}</span>
                <span className="text-body">
                  {' — '}
                  {list
                    .map((d) => `${firstName(nameOf(team, d.owner_id))} (${d.stage})`)
                    .join(' vs ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-body">
            Sort out who owns it before either of you calls again. Lists A and B exist so this
            does not happen.
          </p>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {totals.map((t) => (
          <Card key={t.person.id} className="flex items-center gap-3">
            <Avatar name={t.person.full_name} you={t.person.id === me?.id} />
            <div className="min-w-0">
              <Label>{t.person.full_name}</Label>
              <p className="tnum font-serif text-2xl leading-tight">{usd(t.open)}</p>
              <p className="text-xs text-body">
                {t.openCount} open {t.openCount === 1 ? 'deal' : 'deals'} · {usd(t.won)} won
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-panel px-4 py-3 text-sm">
        {cap <= 0 ? (
          <span className="text-body">No weekly hours cap set yet.</span>
        ) : free ? (
          <span>
            <span className="text-body">Earliest free build capacity: </span>
            <span className="font-medium">
              {weekLabel(free.week, free.weeksAway)} · {free.free}h/week
            </span>
            <span className="text-body"> — quote that start date instead of discounting.</span>
          </span>
        ) : (
          <span className="font-medium text-alarm">
            No free build capacity in the next 6 months. Don't promise a start date.
          </span>
        )}
        <button
          onClick={() => setMineOnly((v) => !v)}
          className="ml-auto rounded-md border border-rule bg-white px-2.5 py-1 text-xs font-medium text-body transition hover:border-body/40 hover:text-ink"
        >
          {mineOnly ? 'Showing mine' : 'Showing everyone'}
        </button>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
        {STAGES.map((stage) => {
          const inStage = visible.filter((d) => d.stage === stage)
          const value = inStage.reduce((s, d) => s + d.value_usd, 0)
          return (
            <section key={stage} className="w-[268px] shrink-0 snap-start">
              <div className="mb-2 flex items-baseline justify-between border-b border-rule pb-1.5">
                <h2 className="text-sm font-semibold">{stage}</h2>
                <span className="tnum text-xs text-muted">
                  {inStage.length} · {usd(value)}
                </span>
              </div>
              <div className="space-y-2">
                {inStage.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    team={team}
                    you={deal.owner_id === me?.id}
                    editable={canEdit(deal)}
                    contested={contested.has(deal.company_key)}
                    onEdit={() =>
                      setEditing({
                        id: deal.id,
                        company: deal.company,
                        owner_id: deal.owner_id,
                        stage: deal.stage,
                        value_usd: String(deal.value_usd),
                        next_action: deal.next_action ?? '',
                        next_action_date: deal.next_action_date ?? '',
                      })
                    }
                    onMove={(s) => void moveStage(deal, s)}
                  />
                ))}
                {inStage.length === 0 && (
                  <p className="rounded-lg border border-dashed border-rule py-6 text-center text-xs text-muted">
                    Nothing here
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editing && (
        <DealForm
          draft={editing}
          deals={deals}
          owners={owners}
          lockOwner={!isAdmin}
          canDelete={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            toast.ok(msg)
            void load()
          }}
        />
      )}
    </div>
  )
}

function DealCard({
  deal,
  team,
  you,
  editable,
  contested,
  onEdit,
  onMove,
}: {
  deal: Deal
  team: Profile[]
  you: boolean
  editable: boolean
  contested: boolean
  onEdit: () => void
  onMove: (stage: Stage) => void
}) {
  const overdue = deal.next_action_date != null && deal.next_action_date < today()
  return (
    <article
      className={`rounded-xl border bg-white p-3 transition ${
        contested ? 'border-alarm ring-1 ring-alarm' : 'border-rule hover:border-body/30'
      }`}
    >
      <button
        onClick={onEdit}
        className="block w-full text-left"
        title={editable ? 'Edit' : 'View — you can only edit your own deals'}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{deal.company}</span>
          <span className="flex shrink-0 items-center gap-1">
            <Avatar name={nameOf(team, deal.owner_id)} you={you} />
          </span>
        </div>
        {contested && (
          <p className="mt-1 text-[11px] font-semibold text-alarm">
            ⚠ also worked by the other owner
          </p>
        )}
        <p className="tnum mt-1.5 font-serif text-lg leading-none">{usd(deal.value_usd)}</p>
        {deal.next_action ? (
          <p className="mt-1.5 text-xs text-body">
            {deal.next_action}
            {deal.next_action_date && (
              <span className={overdue ? 'font-semibold text-alarm' : ''}>
                {' · '}
                {shortDate(deal.next_action_date)}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-warn">No next action</p>
        )}
      </button>

      {editable ? (
        <select
          value={deal.stage}
          onChange={(e) => onMove(e.target.value as Stage)}
          aria-label={`Stage for ${deal.company}`}
          className="mt-2.5 w-full rounded-md border border-rule bg-panel px-2 py-1 text-xs text-body transition hover:border-body/40"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2.5 text-[11px] text-muted">{nameOf(team, deal.owner_id)}'s deal</p>
      )}
    </article>
  )
}

function DealForm({
  draft,
  deals,
  owners,
  lockOwner,
  canDelete,
  onClose,
  onSaved,
}: {
  draft: Draft
  deals: Deal[]
  owners: Profile[]
  lockOwner: boolean
  canDelete: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { me } = useSession()
  const toast = useToast()
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)
  const readOnly = !!form.id && lockOwner && form.owner_id !== me?.id

  const clash = useMemo(() => {
    const key = normalise(form.company)
    if (!key) return null
    return (
      deals.find(
        (d) =>
          d.id !== form.id &&
          d.company_key === key &&
          d.owner_id !== form.owner_id &&
          d.stage !== 'Lost',
      ) ?? null
    )
  }, [form.company, form.owner_id, form.id, deals])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      company: form.company.trim(),
      owner_id: form.owner_id,
      stage: form.stage,
      value_usd: Number(form.value_usd || 0),
      next_action: form.next_action.trim() || null,
      next_action_date: form.next_action_date || null,
      ...(form.id ? {} : { created_by: me?.id ?? null }),
    }
    const { error } = form.id
      ? await supabase.from('deals').update(payload).eq('id', form.id)
      : await supabase.from('deals').insert(payload)
    setBusy(false)
    if (error) toast.bad(error.message)
    else onSaved(form.id ? 'Deal saved' : `${payload.company} added`)
  }

  async function remove() {
    if (!form.id || !window.confirm(`Delete ${form.company}? This cannot be undone.`)) return
    const { error } = await supabase.from('deals').delete().eq('id', form.id)
    if (error) toast.bad(error.message)
    else onSaved('Deal deleted')
  }

  const ownerName = owners.find((o) => o.id === form.owner_id)?.full_name ?? '—'

  return (
    <Modal
      title={!form.id ? 'Add deal' : readOnly ? 'Deal' : 'Edit deal'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button type="submit" form="deal-form" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {form.id && !readOnly && (
            <Button
              variant="danger"
              onClick={remove}
              className="ml-auto"
              disabled={!canDelete}
              disabledReason="Only Abid can delete a deal — leads belong to the business (clause 7)"
            >
              Delete
            </Button>
          )}
        </div>
      }
    >
      {readOnly && (
        <p className="mb-4 rounded-lg border border-rule bg-panel px-3.5 py-2.5 text-xs text-body">
          This is {ownerName}'s deal. You can see it — the duplicate check needs that — but only
          they or Abid can change it.
        </p>
      )}

      <form id="deal-form" onSubmit={save} className="space-y-4">
        <Field label="Company">
          <Input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
            autoFocus={!readOnly}
            disabled={readOnly}
          />
        </Field>

        {clash && (
          <div className="rounded-lg border-2 border-alarm bg-alarm/10 px-3.5 py-2.5 text-sm text-alarm">
            ⚠ This company is already in the pipeline under another owner at{' '}
            <span className="font-semibold">{clash.stage}</span>. Talk to them before saving.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <Select
              value={form.owner_id}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              disabled={readOnly || lockOwner}
              required
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
              disabled={readOnly}
            >
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>

        {lockOwner && !form.id && (
          <p className="-mt-2 text-xs text-muted">
            Deals you create are yours. Only Abid can reassign one.
          </p>
        )}

        <Field label="Estimated value (USD)">
          <Input
            type="number"
            min="0"
            step="100"
            inputMode="decimal"
            value={form.value_usd}
            onChange={(e) => setForm({ ...form, value_usd: e.target.value })}
            disabled={readOnly}
          />
        </Field>

        <Field label="Next action">
          <Input
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
            placeholder="Send the scoping call invite"
            disabled={readOnly}
          />
        </Field>

        <Field label="Next action date">
          <Input
            type="date"
            value={form.next_action_date}
            onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
            disabled={readOnly}
          />
        </Field>
      </form>
    </Modal>
  )
}
