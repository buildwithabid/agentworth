import { supabase } from './supabase'
import type {
  ChecklistStep,
  Deal,
  LedgerEntry,
  Project,
  Settings,
  Task,
} from './types'

const num = (v: unknown) => Number(v ?? 0)

export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('next_action_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((d) => ({ ...d, value_usd: num(d.value_usd) })) as Deal[]
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('start_date')
  if (error) throw error
  return (data ?? []).map((p) => ({
    ...p,
    est_hours_per_week: num(p.est_hours_per_week),
  })) as Project[]
}

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('capacity_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return {
    ...data,
    weekly_hours_cap: num(data.weekly_hours_cap),
    approval_threshold_pkr: num(data.approval_threshold_pkr),
    approval_threshold_usd: num(data.approval_threshold_usd),
  } as Settings
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function fetchChecklist(): Promise<ChecklistStep[]> {
  const { data, error } = await supabase
    .from('checklist_steps')
    .select('*')
    .order('phase_order')
    .order('step_order')
  if (error) throw error
  return (data ?? []) as ChecklistStep[]
}

export async function fetchLedger(): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .order('entry_date')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((e) => ({ ...e, amount: num(e.amount) })) as LedgerEntry[]
}
