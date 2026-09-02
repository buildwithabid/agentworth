import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchTasks } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { Task, TaskStatus } from '../lib/types'
import { TASK_STATUSES, TASK_STATUS_LABEL } from '../lib/types'
import { relativeDay, shortDate, today } from '../lib/format'
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorBanner,
  Field,
  Input,
  LoadingScreen,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../components/ui'

type Draft = {
  id?: string
  title: string
  detail: string
  assignee_id: string
  due_date: string
  status: TaskStatus
}

const blank = (assignee: string): Draft => ({
  title: '',
  detail: '',
  assignee_id: assignee,
  due_date: '',
  status: 'todo',
})

type Filter = 'mine' | 'open' | 'all'

export default function Tasks() {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [filter, setFilter] = useState<Filter>('mine')

  const load = useCallback(async () => {
    try {
      setTasks(await fetchTasks())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = useCallback(
    (t: Task) => isAdmin || t.assignee_id === me?.id || t.created_by === me?.id,
    [isAdmin, me],
  )

  const shown = useMemo(() => {
    const all = tasks ?? []
    if (filter === 'mine') return all.filter((t) => t.assignee_id === me?.id && t.status !== 'done')
    if (filter === 'open') return all.filter((t) => t.status !== 'done')
    return all
  }, [tasks, filter, me])

  const counts = useMemo(() => {
    const all = tasks ?? []
    return {
      mine: all.filter((t) => t.assignee_id === me?.id && t.status !== 'done').length,
      open: all.filter((t) => t.status !== 'done').length,
      all: all.length,
      overdue: all.filter(
        (t) => t.status !== 'done' && t.due_date != null && t.due_date < today(),
      ).length,
      unassigned: all.filter((t) => t.status !== 'done' && !t.assignee_id).length,
    }
  }, [tasks, me])

  async function setStatus(task: Task, status: TaskStatus) {
    const before = tasks
    setTasks((prev) => (prev ?? []).map((t) => (t.id === task.id ? { ...t, status } : t)))
    const { error } = await supabase.from('tasks').update({ status }).eq('id', task.id)
    if (error) {
      setTasks(before)
      toast.bad(error.message)
    } else {
      if (status === 'done') toast.ok('Done')
      void load()
    }
  }

  if (error && !tasks) return <ErrorBanner message={error} />
  if (!tasks) return <LoadingScreen />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Tasks"
        subtitle="Everything here has one named owner. That is the point — “we'll all watch it” is how things get missed."
        actions={<Button onClick={() => setEditing(blank(me?.id ?? ''))}>Add task</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['mine', `Mine (${counts.mine})`],
            ['open', `Open (${counts.open})`],
            ['all', `All (${counts.all})`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === key
                ? 'bg-accent text-paper'
                : 'border border-rule bg-white text-body hover:border-body/40 hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
        {counts.overdue > 0 && (
          <span className="ml-auto">
            <Badge tone="alarm">{counts.overdue} overdue</Badge>
          </span>
        )}
        {counts.unassigned > 0 && <Badge tone="warn">{counts.unassigned} unassigned</Badge>}
      </div>

      {shown.length === 0 ? (
        <Empty
          title={filter === 'mine' ? 'Nothing assigned to you' : 'No tasks yet'}
          hint={
            filter === 'mine'
              ? 'Anything with your name on it will show up here.'
              : 'Raise the things that keep slipping — filings, renewals, the follow-up nobody owns.'
          }
          action={<Button onClick={() => setEditing(blank(me?.id ?? ''))}>Add task</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => {
            const overdue = t.status !== 'done' && t.due_date != null && t.due_date < today()
            const editable = canEdit(t)
            return (
              <li
                key={t.id}
                className={`flex items-start gap-3 rounded-xl border bg-white p-3.5 transition ${
                  overdue ? 'border-alarm/50' : 'border-rule hover:border-body/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.status === 'done'}
                  disabled={!editable}
                  onChange={(e) => void setStatus(t, e.target.checked ? 'done' : 'todo')}
                  aria-label={`Mark ${t.title} done`}
                  title={editable ? undefined : 'Only the assignee, the author or Abid can move this'}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#1f4d3f] disabled:opacity-30"
                />

                <button
                  onClick={() =>
                    setEditing({
                      id: t.id,
                      title: t.title,
                      detail: t.detail ?? '',
                      assignee_id: t.assignee_id ?? '',
                      due_date: t.due_date ?? '',
                      status: t.status,
                    })
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={`font-medium ${
                      t.status === 'done' ? 'text-muted line-through' : ''
                    }`}
                  >
                    {t.title}
                  </p>
                  {t.detail && <p className="mt-0.5 line-clamp-2 text-xs text-body">{t.detail}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar
                        name={nameOf(team, t.assignee_id)}
                        you={t.assignee_id === me?.id}
                      />
                      {nameOf(team, t.assignee_id)}
                    </span>
                    {t.due_date && (
                      <span className={overdue ? 'font-semibold text-alarm' : ''}>
                        due {shortDate(t.due_date)} · {relativeDay(t.due_date)}
                      </span>
                    )}
                    {t.status === 'doing' && <Badge tone="accent">in progress</Badge>}
                  </div>
                </button>

                {editable && t.status !== 'done' && (
                  <select
                    value={t.status}
                    onChange={(e) => void setStatus(t, e.target.value as TaskStatus)}
                    aria-label={`Status of ${t.title}`}
                    className="shrink-0 rounded-md border border-rule bg-panel px-2 py-1 text-xs text-body"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <TaskForm
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(m, assigneeId) => {
            setEditing(null)
            toast.ok(m)
            // a task raised for someone else is invisible under "Mine" — show it
            if (filter === 'mine' && assigneeId !== me?.id) setFilter('open')
            void load()
          }}
        />
      )}
    </div>
  )
}

function TaskForm({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft
  onClose: () => void
  onSaved: (message: string, assigneeId: string | null) => void
}) {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)
  const members = team.filter((p) => p.role !== 'pending')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      detail: form.detail.trim() || null,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      status: form.status,
      ...(form.id ? {} : { created_by: me?.id ?? null }),
    }
    const { error } = form.id
      ? await supabase.from('tasks').update(payload).eq('id', form.id)
      : await supabase.from('tasks').insert(payload)
    setBusy(false)
    if (error) toast.bad(error.message)
    else onSaved(form.id ? 'Task saved' : 'Task added', payload.assignee_id)
  }

  async function remove() {
    if (!form.id || !window.confirm(`Delete "${form.title}"?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', form.id)
    if (error) toast.bad(error.message)
    else onSaved('Task deleted', null)
  }

  return (
    <Modal
      title={form.id ? 'Edit task' : 'Add task'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button type="submit" form="task-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          {form.id && (
            <Button
              variant="danger"
              onClick={remove}
              className="ml-auto"
              disabledReason={isAdmin ? undefined : 'You can delete tasks you raised'}
            >
              Delete
            </Button>
          )}
        </div>
      }
    >
      <form id="task-form" onSubmit={save} className="space-y-4">
        <Field label="Task">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            autoFocus
            placeholder="File the PSEB renewal"
          />
        </Field>
        <Field label="Detail" hint="Optional">
          <Textarea
            rows={3}
            value={form.detail}
            onChange={(e) => setForm({ ...form, detail: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <Select
              value={form.assignee_id}
              onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            >
              <option value="">Unassigned</option>
              {members.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due">
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
