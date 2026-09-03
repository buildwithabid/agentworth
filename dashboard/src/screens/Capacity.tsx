import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProjects, fetchSettings } from '../lib/data'
import { useSession } from '../lib/session'
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
import {
  Bar,
  Button,
  Card,
  Empty,
  ErrorBanner,
  Field,
  Input,
  Label,
  LoadingScreen,
  Modal,
  PageHeader,
  ReadOnlyNote,
  Select,
  useToast,
} from '../components/ui'
import { IconPlus } from '../components/icons'

type Draft = {
  id?: string
  name: string
  client: string
  est_hours_per_week: string
  start_date: string
  end_date: string
  status: 'active' | 'done'
}

const blank = (): Draft => ({
  name: '',
  client: '',
  est_hours_per_week: '',
  start_date: today(),
  end_date: '',
  status: 'active',
})

const HORIZON = 8

export default function Capacity() {
  const { isAdmin } = useSession()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [cap, setCap] = useState(0)
  const [capDraft, setCapDraft] = useState('')
  const [savingCap, setSavingCap] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fetchProjects(), fetchSettings()])
      setProjects(p)
      setCap(s.weekly_hours_cap)
      setCapDraft(String(s.weekly_hours_cap))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const thisWeek = useMemo(() => weekOf(new Date()), [])
  const committed = useMemo(() => committedInWeek(projects ?? [], thisWeek), [projects, thisWeek])
  const free = useMemo(() => earliestFreeWeek(projects ?? [], cap), [projects, cap])
  const weeks = useMemo(() => nextWeeks(HORIZON), [])

  async function saveCap() {
    const value = Number(capDraft)
    if (!Number.isFinite(value) || value < 0) return
    setSavingCap(true)
    const { error } = await supabase
      .from('capacity_settings')
      .update({ weekly_hours_cap: value })
      .eq('id', 1)
    setSavingCap(false)
    if (error) toast.bad(error.message)
    else {
      toast.ok(`Cap set to ${hours(value)}/week`)
      void load()
    }
  }

  if (error && !projects) return <ErrorBanner message={error} />
  if (!projects) return <LoadingScreen />

  const over = committed > cap
  const active = projects.filter((p) => p.status === 'active')
  const done = projects.filter((p) => p.status === 'done')

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Capacity"
        subtitle="Abid's build capacity. Two people sell into this one number."
        actions={
          isAdmin ? (
            <Button onClick={() => setEditing(blank())} icon={<IconPlus size={15} />}>
              Add project
            </Button>
          ) : undefined
        }
      />

      {!isAdmin && (
        <ReadOnlyNote>
          Read only. The technical founder sets the cap and the project list (founders' agreement,
          clause 2) — you work to it.
        </ReadOnlyNote>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Label>
              This week · {shortDate(thisWeek.start)}–{shortDate(thisWeek.end)}
            </Label>
            <p className={`tnum mt-1 font-serif text-3xl leading-none ${over ? 'text-alarm' : ''}`}>
              {hours(committed)}{' '}
              <span className="text-lg text-body">of {hours(cap)}</span>
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-24">
              <Field label="Weekly cap">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={capDraft}
                  onChange={(e) => setCapDraft(e.target.value)}
                  disabled={!isAdmin}
                />
              </Field>
            </div>
            <Button
              variant="quiet"
              onClick={() => void saveCap()}
              disabled={!isAdmin || savingCap || capDraft === String(cap)}
              disabledReason={!isAdmin ? 'Only Abid sets the cap' : undefined}
            >
              {savingCap ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <Bar value={committed} max={cap} height="h-7" />

        <p className={`mt-2.5 text-sm ${over ? 'font-semibold text-alarm' : 'text-body'}`}>
          {over
            ? `Over cap by ${hours(committed - cap)}. Abid is oversold — something slips or gets pushed out.`
            : `${hours(Math.max(cap - committed, 0))} free this week.`}
        </p>
      </Card>

      <Card className="mb-4 bg-panel">
        <Label>Earliest week with free capacity</Label>
        {cap <= 0 ? (
          <p className="mt-1 font-serif text-xl">Set a weekly cap first.</p>
        ) : free ? (
          <p className="mt-1 font-serif text-xl first-letter:uppercase">
            {weekLabel(free.week, free.weeksAway)}
            <span className="text-body"> — {hours(free.free)}/week free</span>
          </p>
        ) : (
          <p className="mt-1 font-serif text-xl text-alarm">
            Nothing free in the next 6 months. Quote a date beyond that or say no.
          </p>
        )}
      </Card>

      <Card className="mb-6">
        <Label>Next {HORIZON} weeks</Label>
        <div className="mt-3 space-y-2">
          {weeks.map((w) => {
            const load = committedInWeek(projects, w)
            return (
              <div key={w.start} className="flex items-center gap-3">
                <span className="tnum w-14 shrink-0 text-xs text-muted">{shortDate(w.start)}</span>
                <div className="min-w-0 flex-1">
                  <Bar value={load} max={cap} height="h-4" />
                </div>
                <span
                  className={`tnum w-20 shrink-0 text-right text-xs ${
                    load > cap ? 'font-semibold text-alarm' : 'text-muted'
                  }`}
                >
                  {hours(load)} / {hours(cap)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <h2 className="mb-2 font-serif text-lg">Active projects</h2>
      <div className="space-y-2">
        {active.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            runningNow={isRunningInWeek(p, thisWeek)}
            clickable={isAdmin}
            onEdit={() => setEditing(toDraft(p))}
          />
        ))}
        {active.length === 0 && (
          <Empty
            title="No active projects"
            hint="All of Abid's hours are free. Add the work that is actually committed so the bar means something."
          />
        )}
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
                clickable={isAdmin}
                onEdit={() => setEditing(toDraft(p))}
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <ProjectForm
          draft={editing}
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

const toDraft = (p: Project): Draft => ({
  id: p.id,
  name: p.name,
  client: p.client ?? '',
  est_hours_per_week: String(p.est_hours_per_week),
  start_date: p.start_date,
  end_date: p.end_date ?? '',
  status: p.status,
})

function ProjectRow({
  project,
  runningNow,
  clickable,
  onEdit,
}: {
  project: Project
  runningNow: boolean
  clickable: boolean
  onEdit: () => void
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {project.name}
          {project.client && <span className="text-body"> · {project.client}</span>}
        </p>
        <p className="text-xs text-muted">
          {shortDate(project.start_date)} →{' '}
          {project.end_date ? shortDate(project.end_date) : 'open-ended'}
          {!runningNow && project.status === 'active' && ' · not running this week'}
        </p>
      </div>
      <span className="tnum shrink-0 font-serif text-lg">
        {hours(project.est_hours_per_week)}
        <span className="text-xs text-muted">/wk</span>
      </span>
    </>
  )
  const cls = 'flex w-full items-center gap-3 rounded-xl border border-rule bg-card p-3 text-left'
  return clickable ? (
    <button onClick={onEdit} className={`${cls} transition hover:border-accent`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function ProjectForm({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const toast = useToast()
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
    if (error) toast.bad(error.message)
    else onSaved(form.id ? 'Project saved' : `${payload.name} added`)
  }

  async function remove() {
    if (!form.id || !window.confirm(`Delete ${form.name}?`)) return
    const { error } = await supabase.from('projects').delete().eq('id', form.id)
    if (error) toast.bad(error.message)
    else onSaved('Project deleted')
  }

  return (
    <Modal
      title={form.id ? 'Edit project' : 'Add project'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button type="submit" form="project-form" disabled={busy}>
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
      }
    >
      <form id="project-form" onSubmit={save} className="space-y-4">
        <Field label="Project">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </Field>
        <Field label="Client">
          <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
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
          <Field label="End" hint="Blank = open-ended">
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
        <p className="text-xs text-muted">
          An open-ended project holds its hours forever, so free capacity never appears. Put an end
          date on anything that should finish.
        </p>
      </form>
    </Modal>
  )
}
