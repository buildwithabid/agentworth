import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCapacity, fetchDeals, fetchProjects } from '../lib/data'
import type { Deal, Owner, Project, Stage } from '../lib/types'
import { OPEN_STAGES, OWNERS, STAGES } from '../lib/types'
import { shortDate, today, usd } from '../lib/format'
import { earliestFreeWeek, weekLabel } from '../lib/capacity'
import { Button, Empty, ErrorBanner, Field, Input, Loading, Modal, Select } from '../components/ui'

type DraftDeal = {
  id?: string
  company: string
  owner: Owner
  stage: Stage
  value_usd: string
  next_action: string
  next_action_date: string
}

const blankDeal: DraftDeal = {
  company: '',
  owner: 'Ikhtisham',
  stage: 'Lead',
  value_usd: '',
  next_action: '',
  next_action_date: '',
}

const normalise = (s: string) => s.trim().toLowerCase()

/** Company names being worked by both owners at once (ignoring dead deals). */
function contestedCompanies(deals: Deal[]): Map<string, Deal[]> {
  const byCompany = new Map<string, Deal[]>()
  for (const d of deals) {
    if (d.stage === 'Lost') continue
    const key = normalise(d.company)
    byCompany.set(key, [...(byCompany.get(key) ?? []), d])
  }
  const contested = new Map<string, Deal[]>()
  for (const [key, list] of byCompany) {
    if (new Set(list.map((d) => d.owner)).size > 1) contested.set(key, list)
  }
  return contested
}

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[] | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [cap, setCap] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<DraftDeal | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, p, c] = await Promise.all([fetchDeals(), fetchProjects(), fetchCapacity()])
      setDeals(d)
      setProjects(p)
      setCap(c.weekly_hours_cap)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const contested = useMemo(() => contestedCompanies(deals ?? []), [deals])

  const totals = useMemo(() => {
    const rows = OWNERS.map((owner) => {
      const mine = (deals ?? []).filter((d) => d.owner === owner)
      return {
        owner,
        open: mine
          .filter((d) => OPEN_STAGES.includes(d.stage))
          .reduce((s, d) => s + d.value_usd, 0),
        won: mine.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value_usd, 0),
        count: mine.filter((d) => OPEN_STAGES.includes(d.stage)).length,
      }
    })
    return rows
  }, [deals])

  const free = useMemo(() => earliestFreeWeek(projects, cap), [projects, cap])

  async function moveStage(deal: Deal, stage: Stage) {
    setDeals((prev) => (prev ?? []).map((d) => (d.id === deal.id ? { ...d, stage } : d)))
    const { error } = await supabase.from('deals').update({ stage }).eq('id', deal.id)
    if (error) setError(error.message)
    void load()
  }

  if (error && !deals) return <ErrorBanner message={error} />
  if (!deals) return <Loading />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="font-serif text-2xl">Pipeline</h1>
        <Button onClick={() => setEditing({ ...blankDeal })}>Add deal</Button>
      </div>

      {contested.size > 0 && (
        <div className="mb-4 rounded-md border-2 border-alarm bg-alarm/10 px-4 py-3">
          <p className="text-sm font-semibold text-alarm">
            ⚠ Same company worked by both owners
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {[...contested.values()].map((list) => (
              <li key={list[0].company_key}>
                <span className="font-medium">{list[0].company}</span>{' '}
                <span className="text-body">
                  — {list.map((d) => `${d.owner} (${d.stage})`).join(' vs ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-body">Sort out who owns it before either of you calls again.</p>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {totals.map((t) => (
          <div key={t.owner} className="rounded-lg border border-rule bg-white p-4">
            <p className="text-xs font-medium tracking-wide text-body uppercase">{t.owner}</p>
            <p className="tnum font-serif text-2xl">{usd(t.open)}</p>
            <p className="text-xs text-body">
              {t.count} open {t.count === 1 ? 'deal' : 'deals'} · {usd(t.won)} won
            </p>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-md border border-rule bg-panel px-4 py-3 text-sm">
        {cap <= 0 ? (
          <span className="text-body">No weekly hours cap set yet — set one on Capacity.</span>
        ) : free ? (
          <span>
            <span className="text-body">Earliest free build capacity:</span>{' '}
            <span className="font-medium">
              {weekLabel(free.week, free.weeksAway)} ({free.free}h/week free)
            </span>
            <span className="text-body"> — quote that start date instead of discounting.</span>
          </span>
        ) : (
          <span className="font-medium text-alarm">
            No free build capacity in the next 6 months. Don't promise a start date.
          </span>
        )}
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
        {STAGES.map((stage) => {
          const inStage = deals.filter((d) => d.stage === stage)
          const value = inStage.reduce((s, d) => s + d.value_usd, 0)
          return (
            <section key={stage} className="w-[270px] shrink-0 snap-start">
              <div className="mb-2 flex items-baseline justify-between border-b border-rule pb-1">
                <h2 className="text-sm font-semibold">{stage}</h2>
                <span className="tnum text-xs text-body">
                  {inStage.length} · {usd(value)}
                </span>
              </div>
              <div className="space-y-2">
                {inStage.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    contested={contested.has(normalise(deal.company))}
                    onEdit={() =>
                      setEditing({
                        id: deal.id,
                        company: deal.company,
                        owner: deal.owner,
                        stage: deal.stage,
                        value_usd: String(deal.value_usd),
                        next_action: deal.next_action ?? '',
                        next_action_date: deal.next_action_date ?? '',
                      })
                    }
                    onMove={(s) => void moveStage(deal, s)}
                  />
                ))}
                {inStage.length === 0 && <Empty>—</Empty>}
              </div>
            </section>
          )
        })}
      </div>

      {editing && (
        <DealForm
          draft={editing}
          deals={deals}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function DealCard({
  deal,
  contested,
  onEdit,
  onMove,
}: {
  deal: Deal
  contested: boolean
  onEdit: () => void
  onMove: (stage: Stage) => void
}) {
  const overdue = deal.next_action_date != null && deal.next_action_date < today()
  return (
    <article
      className={`rounded-lg border bg-white p-3 ${
        contested ? 'border-alarm ring-1 ring-alarm' : 'border-rule'
      }`}
    >
      <button onClick={onEdit} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{deal.company}</span>
          <span className="shrink-0 rounded bg-panel px-1.5 py-0.5 text-[11px] text-body">
            {deal.owner}
          </span>
        </div>
        {contested && (
          <p className="mt-1 text-[11px] font-semibold text-alarm">⚠ also worked by the other owner</p>
        )}
        <p className="tnum mt-1 font-serif text-lg">{usd(deal.value_usd)}</p>
        {deal.next_action && (
          <p className="mt-1 text-xs text-body">
            {deal.next_action}
            {deal.next_action_date && (
              <span className={overdue ? 'font-semibold text-alarm' : ''}>
                {' '}· {shortDate(deal.next_action_date)}
              </span>
            )}
          </p>
        )}
        {!deal.next_action && <p className="mt-1 text-xs text-alarm">No next action</p>}
      </button>
      <select
        value={deal.stage}
        onChange={(e) => onMove(e.target.value as Stage)}
        aria-label={`Stage for ${deal.company}`}
        className="mt-2 w-full rounded border border-rule bg-panel px-2 py-1 text-xs text-body"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </article>
  )
}

function DealForm({
  draft,
  deals,
  onClose,
  onSaved,
  onError,
}: {
  draft: DraftDeal
  deals: Deal[]
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)

  const clash = useMemo(() => {
    const key = normalise(form.company)
    if (!key) return null
    return (
      deals.find(
        (d) => d.id !== form.id && d.company_key === key && d.owner !== form.owner && d.stage !== 'Lost',
      ) ?? null
    )
  }, [form.company, form.owner, form.id, deals])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      company: form.company.trim(),
      owner: form.owner,
      stage: form.stage,
      value_usd: Number(form.value_usd || 0),
      next_action: form.next_action.trim() || null,
      next_action_date: form.next_action_date || null,
    }
    const { error } = form.id
      ? await supabase.from('deals').update(payload).eq('id', form.id)
      : await supabase.from('deals').insert(payload)
    setBusy(false)
    if (error) onError(error.message)
    else onSaved()
  }

  async function remove() {
    if (!form.id || !window.confirm(`Delete ${form.company}?`)) return
    const { error } = await supabase.from('deals').delete().eq('id', form.id)
    if (error) onError(error.message)
    else onSaved()
  }

  return (
    <Modal title={form.id ? 'Edit deal' : 'Add deal'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Company">
          <Input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
            autoFocus
          />
        </Field>

        {clash && (
          <div className="rounded-md border-2 border-alarm bg-alarm/10 px-3 py-2 text-sm text-alarm">
            ⚠ {clash.owner} already has <span className="font-semibold">{clash.company}</span> at{' '}
            {clash.stage}. Talk to them before saving this.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <Select
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value as Owner })}
            >
              {OWNERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
            >
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Estimated value (USD)">
          <Input
            type="number"
            min="0"
            step="100"
            inputMode="decimal"
            value={form.value_usd}
            onChange={(e) => setForm({ ...form, value_usd: e.target.value })}
          />
        </Field>

        <Field label="Next action">
          <Input
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
            placeholder="Send scoping call invite"
          />
        </Field>

        <Field label="Next action date">
          <Input
            type="date"
            value={form.next_action_date}
            onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
          />
        </Field>

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          {form.id && (
            <Button variant="danger" onClick={remove} className="ml-auto">
              Delete
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
