import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchLedger, fetchSettings } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { Currency, LedgerEntry, Settings } from '../lib/types'
import { CURRENCIES } from '../lib/types'
import { daysBetween, money, shortDate, today } from '../lib/format'
import {
  Alarm,
  Badge,
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
  entry_date: string
  client: string
  amount: string
  currency: Currency
  direction: 'in' | 'out'
  prc_received: boolean
  note: string
}

const blank = (): Draft => ({
  entry_date: today(),
  client: '',
  amount: '',
  currency: 'USD',
  direction: 'in',
  prc_received: false,
  note: '',
})

const PRC_GRACE_DAYS = 30

/** Clause 6: money out above the threshold needs a second founder's signature. */
function needsApproval(e: LedgerEntry, s: Settings): boolean {
  if (e.direction !== 'out') return false
  const limit = e.currency === 'PKR' ? s.approval_threshold_pkr : s.approval_threshold_usd
  return e.amount > limit
}

function prcOverdue(e: LedgerEntry): boolean {
  return e.direction === 'in' && !e.prc_received && daysBetween(e.entry_date, today()) > PRC_GRACE_DAYS
}

export default function Ledger() {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [rows, setRows] = useState<LedgerEntry[] | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([fetchLedger(), fetchSettings()])
      setRows(l)
      setSettings(s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Running balance is per currency — USD and PKR cannot be added together. */
  const withBalance = useMemo(() => {
    const running: Record<string, number> = { USD: 0, PKR: 0 }
    return (rows ?? []).map((e) => {
      running[e.currency] += e.direction === 'in' ? e.amount : -e.amount
      return { entry: e, balance: running[e.currency] }
    })
  }, [rows])

  const balances = useMemo(() => {
    const out: Record<string, number> = { USD: 0, PKR: 0 }
    for (const e of rows ?? []) out[e.currency] += e.direction === 'in' ? e.amount : -e.amount
    return out
  }, [rows])

  const flagged = useMemo(() => (rows ?? []).filter(prcOverdue), [rows])
  const awaiting = useMemo(
    () => (settings ? (rows ?? []).filter((e) => needsApproval(e, settings) && !e.approved_by) : []),
    [rows, settings],
  )

  async function approve(e: LedgerEntry) {
    const { error } = await supabase
      .from('ledger_entries')
      .update({ approved_by: me?.id })
      .eq('id', e.id)
    if (error) toast.bad(error.message)
    else {
      toast.ok('Approval recorded')
      void load()
    }
  }

  async function togglePrc(e: LedgerEntry) {
    const { error } = await supabase
      .from('ledger_entries')
      .update({ prc_received: !e.prc_received })
      .eq('id', e.id)
    if (error) toast.bad(error.message)
    else void load()
  }

  if (error && !rows) return <ErrorBanner message={error} />
  if (!rows || !settings) return <LoadingScreen />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Ledger"
        subtitle="Money still lands in Abid's personal account, so all three of you see every line of it."
        actions={isAdmin ? <Button onClick={() => setEditing(blank())} icon={<IconPlus size={15} />}>
              Add entry
            </Button> : undefined}
      />

      {!isAdmin && (
        <ReadOnlyNote>
          You can see everything and sign off payments, but only Abid records entries — the account
          is in his name until the company account opens (clause 6).
        </ReadOnlyNote>
      )}

      <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {CURRENCIES.map((c) => (
          <Card key={c}>
            <Label>{c} balance</Label>
            <p
              className={`tnum mt-1 font-serif text-2xl leading-none ${
                balances[c] < 0 ? 'text-alarm' : ''
              }`}
            >
              {money(balances[c], c)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {(rows ?? []).filter((e) => e.currency === c).length} entries
            </p>
          </Card>
        ))}
      </div>

      {flagged.length > 0 && (
        <Alarm
          title={`${flagged.length} incoming ${
            flagged.length === 1 ? 'payment' : 'payments'
          } over ${PRC_GRACE_DAYS} days old with no PRC`}
        >
          <ul className="space-y-1 text-sm">
            {flagged.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{money(e.amount, e.currency)}</span>
                <span className="text-body">
                  {' '}
                  {e.client ? `from ${e.client}` : ''} · {shortDate(e.entry_date)} ·{' '}
                  {daysBetween(e.entry_date, today())} days
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-body">
            Every foreign receipt needs its PRC filed against it. Chase the bank.
          </p>
        </Alarm>
      )}

      {awaiting.length > 0 && (
        <Alarm
          tone="warn"
          title={`${awaiting.length} ${
            awaiting.length === 1 ? 'payment needs' : 'payments need'
          } a second founder's approval`}
        >
          <p className="text-xs text-body">
            Clause 6: spending above {money(settings.approval_threshold_pkr, 'PKR')} needs another
            founder to sign it off. Whoever recorded it cannot be the one who approves it.
          </p>
        </Alarm>
      )}

      {rows.length === 0 ? (
        <Empty
          title="No entries yet"
          hint="Log every receipt and payout here — that is the sheet clause 6 asks for."
          action={isAdmin ? <Button onClick={() => setEditing(blank())} icon={<IconPlus size={15} />}>
              Add entry
            </Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-card shadow-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-rule bg-panel text-left">
              <tr className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5 text-right">In</th>
                <th className="px-3 py-2.5 text-right">Out</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5">PRC</th>
                <th className="px-3 py-2.5">Approval</th>
                <th className="px-3 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.map(({ entry: e, balance }) => {
                const overdue = prcOverdue(e)
                const wants = needsApproval(e, settings)
                const canApprove = !e.approved_by && e.created_by !== me?.id
                return (
                  <tr
                    key={e.id}
                    className={`border-b border-rule/60 last:border-0 ${
                      overdue ? 'bg-alarm/5' : ''
                    }`}
                  >
                    <td className="tnum px-3 py-2.5 whitespace-nowrap">
                      {shortDate(e.entry_date)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isAdmin ? (
                        <button
                          className="text-left underline decoration-rule underline-offset-2 hover:decoration-ink"
                          onClick={() =>
                            setEditing({
                              id: e.id,
                              entry_date: e.entry_date,
                              client: e.client ?? '',
                              amount: String(e.amount),
                              currency: e.currency,
                              direction: e.direction,
                              prc_received: e.prc_received,
                              note: e.note ?? '',
                            })
                          }
                        >
                          {e.client || '—'}
                        </button>
                      ) : (
                        e.client || '—'
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-accent">
                      {e.direction === 'in' ? money(e.amount, e.currency) : ''}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-alarm">
                      {e.direction === 'out' ? money(e.amount, e.currency) : ''}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">
                      {money(balance, e.currency)}
                    </td>
                    <td className="px-3 py-2.5">
                      {e.direction === 'in' ? (
                        <button
                          onClick={() => isAdmin && void togglePrc(e)}
                          disabled={!isAdmin}
                          title={isAdmin ? 'Toggle PRC received' : 'Only Abid updates the PRC flag'}
                          className={!isAdmin ? 'cursor-default' : ''}
                        >
                          {e.prc_received ? (
                            <Badge tone="accent">received</Badge>
                          ) : overdue ? (
                            <Badge tone="alarm">
                              {daysBetween(e.entry_date, today())}d, none
                            </Badge>
                          ) : (
                            <Badge tone="warn">waiting</Badge>
                          )}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {!wants ? (
                        <span className="text-muted">—</span>
                      ) : e.approved_by ? (
                        <Badge tone="accent">{nameOf(team, e.approved_by)}</Badge>
                      ) : canApprove ? (
                        <Button size="sm" variant="quiet" onClick={() => void approve(e)}>
                          Approve
                        </Button>
                      ) : (
                        <Badge tone="warn">needs another founder</Badge>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-2.5 text-xs text-body">{e.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EntryForm
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

function EntryForm({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { me } = useSession()
  const toast = useToast()
  const [form, setForm] = useState(draft)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const payload = {
      entry_date: form.entry_date,
      client: form.client.trim() || null,
      amount: Number(form.amount || 0),
      currency: form.currency,
      direction: form.direction,
      prc_received: form.direction === 'in' ? form.prc_received : false,
      note: form.note.trim() || null,
      ...(form.id ? {} : { created_by: me?.id ?? null }),
    }
    const { error } = form.id
      ? await supabase.from('ledger_entries').update(payload).eq('id', form.id)
      : await supabase.from('ledger_entries').insert(payload)
    setBusy(false)
    if (error) toast.bad(error.message)
    else onSaved(form.id ? 'Entry saved' : 'Entry recorded')
  }

  async function remove() {
    if (!form.id || !window.confirm('Delete this entry?')) return
    const { error } = await supabase.from('ledger_entries').delete().eq('id', form.id)
    if (error) toast.bad(error.message)
    else onSaved('Entry deleted')
  }

  return (
    <Modal
      title={form.id ? 'Edit entry' : 'Add entry'}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <Button type="submit" form="entry-form" disabled={busy}>
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
      <form id="entry-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field label="Direction">
            <Select
              value={form.direction}
              onChange={(e) =>
                setForm({ ...form, direction: e.target.value as 'in' | 'out' })
              }
            >
              <option value="in">Money in</option>
              <option value="out">Money out</option>
            </Select>
          </Field>
        </div>

        <Field label="Client or payee">
          <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </Field>
          <Field label="Currency">
            <Select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>

        {form.direction === 'in' && (
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.prc_received}
              onChange={(e) => setForm({ ...form, prc_received: e.target.checked })}
              className="h-[18px] w-[18px] accent-[color:var(--color-accent)]"
            />
            PRC received from the bank
          </label>
        )}

        <Field label="Note">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>

        {form.direction === 'out' && (
          <p className="text-xs text-muted">
            Payments above the clause 6 threshold need a second founder to approve them here. You
            cannot approve one you recorded yourself.
          </p>
        )}
      </form>
    </Modal>
  )
}
