import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchChecklist } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { ChecklistStep } from '../lib/types'
import { shortDate, today } from '../lib/format'
import {
  Avatar,
  Badge,
  Bar,
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
  Textarea,
  useToast,
} from '../components/ui'

export default function Checklist() {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [steps, setSteps] = useState<ChecklistStep[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ChecklistStep | null>(null)
  const [mineOnly, setMineOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      setSteps(await fetchChecklist())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(
    () => (steps ?? []).filter((s) => !mineOnly || s.owner_id === me?.id),
    [steps, mineOnly, me],
  )

  const perPerson = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const s of steps ?? []) {
      if (!s.owner_id) continue
      const b = map.get(s.owner_id) ?? { done: 0, total: 0 }
      b.total++
      if (s.done) b.done++
      map.set(s.owner_id, b)
    }
    return [...map.entries()]
  }, [steps])

  const phases = useMemo(() => {
    const map = new Map<number, { phase: string; when: string | null; steps: ChecklistStep[] }>()
    for (const s of shown) {
      const bucket = map.get(s.phase_order) ?? {
        phase: s.phase,
        when: s.phase_when,
        steps: [],
      }
      bucket.steps.push(s)
      map.set(s.phase_order, bucket)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [shown])

  const doneCount = (steps ?? []).filter((s) => s.done).length
  const total = (steps ?? []).length

  /** Anyone can tick a shared step; a named step belongs to its owner or Abid. */
  const canTick = useCallback(
    (s: ChecklistStep) => isAdmin || s.owner_id == null || s.owner_id === me?.id,
    [isAdmin, me],
  )

  async function toggle(step: ChecklistStep, done: boolean) {
    const before = steps
    setSteps((prev) =>
      (prev ?? []).map((s) =>
        s.id === step.id ? { ...s, done, completed_date: done ? today() : null } : s,
      ),
    )
    const { error } = await supabase
      .from('checklist_steps')
      .update({ done, completed_date: done ? today() : null })
      .eq('id', step.id)
    if (error) {
      setSteps(before)
      toast.bad(error.message)
    } else {
      void load()
    }
  }

  if (error && !steps) return <ErrorBanner message={error} />
  if (!steps) return <LoadingScreen />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Setup checklist"
        subtitle="The plan, in order, with one named owner on every line. Clients before company, company before hiring."
      />

      <Card className="mb-5">
        <div className="flex items-center gap-4">
          <span className="tnum shrink-0 font-serif text-2xl">
            {doneCount}
            <span className="text-body"> of {total}</span>
          </span>
          <div className="min-w-0 flex-1">
            <Bar value={doneCount} max={total || 1} height="h-3" />
          </div>
          <button
            onClick={() => setMineOnly((v) => !v)}
            className="shrink-0 rounded-md border border-rule bg-white px-2.5 py-1 text-xs font-medium text-body transition hover:border-body/40 hover:text-ink"
          >
            {mineOnly ? 'Showing mine' : 'Showing everyone'}
          </button>
        </div>

        {perPerson.length > 0 && (
          <div className="mt-4 border-t border-rule pt-3">
            <Label>Who owns what</Label>
            <div className="mt-2 space-y-2">
              {perPerson.map(([id, b]) => (
                <div key={id} className="flex items-center gap-3">
                  <Avatar name={nameOf(team, id)} you={id === me?.id} />
                  <span className="w-36 shrink-0 truncate text-sm">{nameOf(team, id)}</span>
                  <div className="min-w-0 flex-1">
                    <Bar value={b.done} max={b.total} height="h-2.5" />
                  </div>
                  <span className="tnum w-12 shrink-0 text-right text-xs text-muted">
                    {b.done}/{b.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {phases.length === 0 && (
        <Card className="text-center text-sm text-body">
          Nothing on this list is yours. Switch to “Showing everyone”.
        </Card>
      )}

      <div className="space-y-8">
        {phases.map(([order, { phase, when, steps: list }]) => {
          const phaseDone = list.filter((s) => s.done).length
          return (
            <section key={order}>
              <div className="mb-3 flex flex-wrap items-baseline gap-3 border-b-2 border-ink pb-2">
                <h2 className="font-serif text-xl">
                  Phase {order} — {phase}
                </h2>
                {when && <Badge>{when}</Badge>}
                <span className="tnum ml-auto text-xs text-muted">
                  {phaseDone}/{list.length}
                </span>
              </div>

              <ol className="space-y-0">
                {list.map((s) => {
                  const tickable = canTick(s)
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[2.6rem_1fr] gap-x-3 border-b border-rule py-3.5"
                    >
                      <span
                        className={`tnum pt-0.5 font-serif text-lg ${
                          s.done ? 'text-muted' : 'text-accent'
                        }`}
                      >
                        {String(s.step_order).padStart(2, '0')}
                        {s.sub_label && <span className="text-sm">{s.sub_label}</span>}
                      </span>
                      <div className="min-w-0">
                        <label
                          className={`flex items-start gap-2.5 ${
                            tickable ? 'cursor-pointer' : 'cursor-not-allowed'
                          }`}
                          title={tickable ? undefined : `Only ${nameOf(team, s.owner_id)} or Abid can tick this`}
                        >
                          <input
                            type="checkbox"
                            checked={s.done}
                            disabled={!tickable}
                            onChange={(e) => void toggle(s, e.target.checked)}
                            className="mt-1 h-[17px] w-[17px] shrink-0 accent-[#1f4d3f] disabled:opacity-30"
                          />
                          <span
                            className={`font-semibold ${
                              s.done ? 'text-muted line-through decoration-rule' : ''
                            }`}
                          >
                            {s.title}
                          </span>
                        </label>

                        <div className={s.done ? 'opacity-50' : ''}>
                          {s.detail && (
                            <p className="mt-1.5 max-w-prose text-sm text-body">{s.detail}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            {s.owner_id ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Avatar
                                  name={nameOf(team, s.owner_id)}
                                  you={s.owner_id === me?.id}
                                />
                                <span className="font-medium text-body">
                                  {nameOf(team, s.owner_id)}
                                </span>
                                {s.owner_id === me?.id && <Badge tone="accent">yours</Badge>}
                              </span>
                            ) : (
                              <Badge tone="warn">no owner</Badge>
                            )}
                            {s.owner_note && <span>{s.owner_note}</span>}
                            {s.meta && <span>{s.meta}</span>}
                            {s.done && s.completed_date && (
                              <Badge tone="accent">done {shortDate(s.completed_date)}</Badge>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setEditing(s)}
                                className="underline decoration-rule underline-offset-2 hover:text-ink"
                              >
                                edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>

      {editing && (
        <StepForm
          step={editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null)
            toast.ok(m)
            void load()
          }}
        />
      )}
    </div>
  )
}

function StepForm({
  step,
  onClose,
  onSaved,
}: {
  step: ChecklistStep
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { team } = useSession()
  const toast = useToast()
  const [form, setForm] = useState({
    title: step.title,
    detail: step.detail ?? '',
    owner_id: step.owner_id ?? '',
    owner_note: step.owner_note ?? '',
    meta: step.meta ?? '',
  })
  const [busy, setBusy] = useState(false)
  const members = team.filter((p) => p.role !== 'pending')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase
      .from('checklist_steps')
      .update({
        title: form.title.trim(),
        detail: form.detail.trim() || null,
        owner_id: form.owner_id || null,
        owner_note: form.owner_note.trim() || null,
        meta: form.meta.trim() || null,
      })
      .eq('id', step.id)
    setBusy(false)
    if (error) toast.bad(error.message)
    else onSaved('Step saved')
  }

  return (
    <Modal
      title={`Step ${String(step.step_order).padStart(2, '0')}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="submit" form="step-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="step-form" onSubmit={save} className="space-y-4">
        <Field label="Title">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </Field>
        <Field label="Detail">
          <Textarea
            rows={4}
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
          />
        </Field>
        <Field
          label="Named owner"
          hint="Leave unassigned for a shared step — then anyone can tick it off."
        >
          <Select
            value={form.owner_id}
            onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
          >
            <option value="">Unassigned (shared)</option>
            {members.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Who (from the plan)">
          <Input
            value={form.owner_note}
            onChange={(e) => setForm({ ...form, owner_note: e.target.value })}
          />
        </Field>
        <Field label="Cost, time, done-when">
          <Input value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} />
        </Field>
      </form>
    </Modal>
  )
}
