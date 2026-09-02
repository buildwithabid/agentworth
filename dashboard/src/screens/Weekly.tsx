import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchChecklist,
  fetchDeals,
  fetchLedger,
  fetchProjects,
  fetchSettings,
  fetchTasks,
} from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { ChecklistStep, Deal, LedgerEntry, Project, Settings, Task } from '../lib/types'
import { OPEN_STAGES } from '../lib/types'
import { daysBetween, hours, money, shortDate, today, usd } from '../lib/format'
import { committedInWeek, earliestFreeWeek, weekLabel, weekOf } from '../lib/capacity'
import {
  Bar,
  Badge,
  Card,
  ErrorBanner,
  Label,
  LoadingScreen,
  PageHeader,
  Stat,
} from '../components/ui'

type Bundle = {
  deals: Deal[]
  projects: Project[]
  settings: Settings
  ledger: LedgerEntry[]
  checklist: ChecklistStep[]
  tasks: Task[]
}

const PRC_GRACE_DAYS = 30

export default function Weekly() {
  const { team, me } = useSession()
  const [data, setData] = useState<Bundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [deals, projects, settings, ledger, checklist, tasks] = await Promise.all([
        fetchDeals(),
        fetchProjects(),
        fetchSettings(),
        fetchLedger(),
        fetchChecklist(),
        fetchTasks(),
      ])
      setData({ deals, projects, settings, ledger, checklist, tasks })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const thisWeek = useMemo(() => weekOf(new Date()), [])

  const view = useMemo(() => {
    if (!data) return null
    const { deals, projects, settings, ledger, checklist, tasks } = data

    const weekStartTs = new Date(`${thisWeek.start}T00:00:00`).getTime()
    const movedThisWeek = deals.filter(
      (d) => new Date(d.stage_changed_at).getTime() >= weekStartTs,
    )

    const sellers = team.filter((p) => p.role === 'sales')
    const perFounder = (sellers.length ? sellers : team).map((p) => {
      const mine = deals.filter((d) => d.owner_id === p.id)
      return {
        person: p,
        open: mine.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value_usd, 0),
        openCount: mine.filter((d) => OPEN_STAGES.includes(d.stage)).length,
        won: mine.filter((d) => d.stage === 'Won').reduce((s, d) => s + d.value_usd, 0),
        moved: movedThisWeek.filter((d) => d.owner_id === p.id).length,
      }
    })

    const committed = committedInWeek(projects, thisWeek)
    const free = earliestFreeWeek(projects, settings.weekly_hours_cap)

    const monthStart = today().slice(0, 8) + '01'
    const cashIn: Record<string, number> = { USD: 0, PKR: 0 }
    const cashOut: Record<string, number> = { USD: 0, PKR: 0 }
    for (const e of ledger) {
      if (e.entry_date < monthStart) continue
      if (e.direction === 'in') cashIn[e.currency] += e.amount
      else cashOut[e.currency] += e.amount
    }

    const missingPrc = ledger.filter(
      (e) =>
        e.direction === 'in' &&
        !e.prc_received &&
        daysBetween(e.entry_date, today()) > PRC_GRACE_DAYS,
    )

    const overdueTasks = tasks.filter(
      (t) => t.status !== 'done' && t.due_date != null && t.due_date < today(),
    )
    const overdueActions = deals.filter(
      (d) =>
        !['Won', 'Lost'].includes(d.stage) &&
        d.next_action_date != null &&
        d.next_action_date < today(),
    )

    return {
      perFounder,
      movedThisWeek,
      committed,
      cap: settings.weekly_hours_cap,
      free,
      cashIn,
      cashOut,
      missingPrc,
      overdueTasks,
      overdueActions,
      checklistDone: checklist.filter((c) => c.done).length,
      checklistTotal: checklist.length,
      checklistThisWeek: checklist.filter(
        (c) => c.done && c.completed_date != null && c.completed_date >= thisWeek.start,
      ),
      totalOpen: deals
        .filter((d) => OPEN_STAGES.includes(d.stage))
        .reduce((s, d) => s + d.value_usd, 0),
    }
  }, [data, team, thisWeek])

  if (error && !data) return <ErrorBanner message={error} />
  if (!data || !view) return <LoadingScreen />

  const over = view.committed > view.cap

  return (
    <div>
      <PageHeader
        title="Weekly numbers"
        subtitle={`Monday meeting, week of ${shortDate(thisWeek.start)}. Pipeline, capacity, cash, what slipped.`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Open pipeline"
            value={usd(view.totalOpen)}
            detail={`${view.movedThisWeek.length} ${
              view.movedThisWeek.length === 1 ? 'deal' : 'deals'
            } moved this week`}
          />
        </Card>
        <Card>
          <Stat
            label="Capacity used"
            value={`${hours(view.committed)} / ${hours(view.cap)}`}
            tone={over ? 'alarm' : 'normal'}
            detail={
              over
                ? `Oversold by ${hours(view.committed - view.cap)}`
                : view.free
                  ? `Free from ${weekLabel(view.free.week, view.free.weeksAway)}`
                  : 'Full for 6 months'
            }
          />
        </Card>
        <Card>
          <Stat
            label="Cash in this month"
            value={money(view.cashIn.USD, 'USD')}
            detail={
              view.cashIn.PKR > 0 || view.cashOut.PKR > 0
                ? `${money(view.cashIn.PKR, 'PKR')} in · ${money(view.cashOut.PKR, 'PKR')} out`
                : `${money(view.cashOut.USD, 'USD')} out`
            }
          />
        </Card>
        <Card>
          <Stat
            label="Checklist"
            value={`${view.checklistDone} / ${view.checklistTotal}`}
            tone="good"
            detail={`${view.checklistThisWeek.length} completed this week`}
          />
        </Card>
      </div>

      <Card className="mb-4">
        <Label>Pipeline per founder</Label>
        <div className="mt-3 space-y-3">
          {view.perFounder.map((f) => (
            <div key={f.person.id} className="flex flex-wrap items-center gap-3">
              <span className="w-36 shrink-0 text-sm font-medium">
                {f.person.full_name}
                {f.person.id === me?.id && <span className="text-muted"> (you)</span>}
              </span>
              <span className="tnum w-24 shrink-0 font-serif text-lg">{usd(f.open)}</span>
              <span className="text-xs text-muted">
                {f.openCount} open · {usd(f.won)} won · {f.moved} moved this week
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <Label>Committed vs cap, this week</Label>
        <div className="mt-3">
          <Bar value={view.committed} max={view.cap} height="h-6" />
          <p className={`mt-2 text-sm ${over ? 'font-semibold text-alarm' : 'text-body'}`}>
            {over
              ? `Over cap by ${hours(view.committed - view.cap)}. Do not sell another immediate start.`
              : `${hours(Math.max(view.cap - view.committed, 0))} free this week.`}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Label>Needs attention</Label>
          <ul className="mt-3 space-y-2 text-sm">
            <AttentionRow
              count={view.missingPrc.length}
              zero="Every incoming payment has its PRC"
              some={(n) => `${n} incoming ${n === 1 ? 'payment' : 'payments'} over 30 days with no PRC`}
            />
            <AttentionRow
              count={view.overdueActions.length}
              zero="No overdue next actions"
              some={(n) => `${n} ${n === 1 ? 'deal has' : 'deals have'} an overdue next action`}
            />
            <AttentionRow
              count={view.overdueTasks.length}
              zero="No overdue tasks"
              some={(n) => `${n} overdue ${n === 1 ? 'task' : 'tasks'}`}
            />
          </ul>
        </Card>

        <Card>
          <Label>Moved this week</Label>
          {view.movedThisWeek.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing changed stage this week. That is itself worth discussing.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {view.movedThisWeek.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {d.company}
                    <span className="text-muted"> · {nameOf(team, d.owner_id)}</span>
                  </span>
                  <Badge tone={d.stage === 'Won' ? 'accent' : d.stage === 'Lost' ? 'alarm' : 'neutral'}>
                    {d.stage}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function AttentionRow({
  count,
  zero,
  some,
}: {
  count: number
  zero: string
  some: (n: number) => string
}) {
  return (
    <li className="flex items-start gap-2">
      <span className={count === 0 ? 'text-accent' : 'text-alarm'}>{count === 0 ? '✓' : '⚠'}</span>
      <span className={count === 0 ? 'text-body' : 'font-medium text-alarm'}>
        {count === 0 ? zero : some(count)}
      </span>
    </li>
  )
}
