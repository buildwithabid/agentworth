import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCapacity, fetchProjects } from '../lib/data'
import type { Project } from '../lib/types'
import { hours, shortDate, today } from '../lib/format'
import {
  committedInWeek,
  earliestFreeWeek,
  isRunningInWeek,
  nextWeeks,
  weekLabel,
  weekOf,
} from '../lib/capacity'
import { Bar, Button, Empty, ErrorBanner, Field, Input, Loading, Modal, Select } from '../components/ui'

type DraftProject = {
  id?: string
  name: string
  client: string
  est_hours_per_week: string
  start_date: string
  end_date: string
  status: 'active' | 'done'
}

const blankProject = (): DraftProject => ({
  name: '',
  client: '',
  est_hours_per_week: '',
  start_date: today(),
  end_date: '',
  status: 'active',
})

const HORIZON_WEEKS = 8

export default function Capacity() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [cap, setCap] = useState(0)
  const [capDraft, setCapDraft] = useState('')
  const [savingCap, setSavingCap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<DraftProject | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchProjects(), fetchCapacity()])
      setProjects(p)
      setCap(c.weekly_hours_cap)
      setCapDraft(String(c.weekly_hours_cap))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const thisWeek = useMemo(() => weekOf(new Date()), [])
  const committed = useMemo(
    () => committedInWeek(projects ?? [], thisWeek),
    [projects, thisWeek],
  )
  const free = useMemo(() => earliestFreeWeek(projects ?? [], cap), [projects, cap])
  const weeks = useMemo(() => nextWeeks(HORIZON_WEEKS), [])

  async function saveCap() {
    const value = Number(capDraft)
    if (!Number.isFinite(value) || value < 0) return
    setSavingCap(true)
    const { error } = await supabase
      .from('capacity_settings')
      .update({ weekly_hours_cap: value })
      .eq('id', 1)
    setSavingCap(false)
    if (error) setError(error.message)
    else void load()
  }

  if (error && !projects) return <ErrorBanner message={error} />
  if (!projects) return <Loading />

  const over = committed > cap
  const active = projects.filter((p) => p.status === 'active')
  const done = projects.filter((p) => p.status === 'done')

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="font-serif text-2xl">Capacity</h1>
        <Button onClick={() => setEditing(blankProject())}>Add project</Button>
      </div>

      <section className="mb-4 rounded-lg border border-rule bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-body uppercase">
              This week ({shortDate(thisWeek.start)}–{shortDate(thisWeek.end)})
            </p>
            <p className={`tnum font-serif text-3xl ${over ? 'text-alarm' : ''}`}>
              {hours(committed)} <span className="text-lg text-body">of {hours(cap)}</span>
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-28">
              <Field label="Weekly cap">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                />
              </Field>
            </div>
            <Button
              variant="quiet"
              onClick={() => void saveCap()}
              disabled={savingCap || capDraft === String(cap)}
            >
              {savingCap ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <Bar value={committed} max={cap} height="h-7" />

        <p className={`mt-2 text-sm ${over ? 'font-semibold text-alarm' : 'text-body'}`}>
          {over
            ? `Over cap by ${hours(committed - cap)}. Abid is oversold — something slips or gets pushed out.`
            : `${hours(Math.max(cap - committed, 0))} free this week.`}
        </p>
      </section>

      <section className="mb-4 rounded-lg border border-rule bg-panel p-4">
        <p className="text-xs font-medium tracking-wide text-body uppercase">
          Earliest week with free capacity
        </p>
        {cap <= 0 ? (
          <p className="font-serif text-xl">Set a weekly cap first.</p>
        ) : free ? (
          <p className="font-serif text-xl first-letter:uppercase">
            {weekLabel(free.week, free.weeksAway)}
            <span className="text-body"> — {hours(free.free)}/week free</span>
          </p>
        ) : (
          <p className="font-serif text-xl text-alarm">
            Nothing free in the next 6 months. Quote a date beyond that or say no.
          </p>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-rule bg-white p-4">
        <p className="mb-3 text-xs font-medium tracking-wide text-body uppercase">
          Next {HORIZON_WEEKS} weeks
        </p>
        <div className="space-y-2">
          {weeks.map((w) => {
            const load = committedInWeek(projects, w)
            return (
              <div key={w.start} className="flex items-center gap-3">
                <span className="tnum w-16 shrink-0 text-xs text-body">{shortDate(w.start)}</span>
                <div className="min-w-0 flex-1">
                  <Bar value={load} max={cap} height="h-4" />
                </div>
                <span
                  className={`tnum w-20 shrink-0 text-right text-xs ${
                    load > cap ? 'font-semibold text-alarm' : 'text-body'
                  }`}
                >
                  {hours(load)} / {hours(cap)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg">Active projects</h2>
        <div className="space-y-2">
          {active.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              runningNow={isRunningInWeek(p, thisWeek)}
              onEdit={() =>
                setEditing({
                  id: p.id,
                  name: p.name,
                  client: p.client ?? '',
                  est_hours_per_week: String(p.est_hours_per_week),
                  start_date: p.start_date,
                  end_date: p.end_date ?? '',
                  status: p.status,
                })
              }
            />
          ))}
          {active.length === 0 && <Empty>No active projects. All of Abid's hours are free.</Empty>}
        </div>

        {done.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 font-serif text-lg text-body">Done</h2>
            <div className="space-y-2 opacity-60">
              {done.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  runningNow={false}
                  onEdit={() =>
                    setEditing({
                      id: p.id,
                      name: p.name,
                      client: p.client ?? '',
                      est_hours_per_week: String(p.est_hours_per_week),
                      start_date: p.start_date,
                      end_date: p.end_date ?? '',
                      status: p.status,
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>

      {editing && (
        <ProjectForm
          draft={editing}
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

function ProjectRow({
  project,
  runningNow,
  onEdit,
}: {
  project: Project
  runningNow: boolean
  onEdit: () => void
}) {
  return (
    <button
      onClick={onEdit}
      className="flex w-full items-center gap-3 rounded-lg border border-rule bg-white p-3 text-left hover:border-accent"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {project.name}
          {project.client && <span className="text-body"> · {project.client}</span>}
        </p>
        <p className="text-xs text-body">
          {shortDate(project.start_date)} →{' '}
          {project.end_date ? shortDate(project.end_date) : 'open-ended'}
          {!runningNow && project.status === 'active' && ' · not running this week'}
        </p>
      </div>
      <span className="tnum shrink-0 font-serif text-lg">
        {hours(project.est_hours_per_week)}
        <span className="text-xs text-body">/wk</span>
      </span>
    </button>
  )
}

function ProjectForm({
  draft,
  onClose,
  onSaved,
  onError,
}: {
  draft: DraftProject
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      name: form.name.trim(),
      client: form.client.trim() || null,
      est_hours_per_week: Number(form.est_hours_per_week || 0),
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status,
    }
    const { error } = form.id
      ? await supabase.from('projects').update(payload).eq('id', form.id)
      : await supabase.from('projects').insert(payload)
    setBusy(false)
    if (error) onError(error.message)
    else onSaved()
  }

  async function remove() {
    if (!form.id || !window.confirm(`Delete ${form.name}?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', form.id)
    if (error) onError(error.message)
    else onSaved()
  }

  return (
    <Modal title={form.id ? 'Edit project' : 'Add project'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Project">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="Client">
          <Input
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
          />
        </Field>
        <Field label="Estimated hours per week">
          <Input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={form.est_hours_per_week}
            onChange={(e) => setForm({ ...form, est_hours_per_week: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </Field>
          <Field label="End (blank = open-ended)">
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'done' })}
          >
            <option value="active">Active</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <p className="text-xs text-body">
          An open-ended project holds its hours forever, so free capacity never appears. Put an end
          date on anything that should finish.
        </p>
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
