import { supabase } from './supabase'
import type { CapacitySettings, Deal, Project } from './types'

export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('next_action_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((d) => ({ ...d, value_usd: Number(d.value_usd) })) as Deal[]
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('start_date')
  if (error) throw error
  return (data ?? []).map((p) => ({
    ...p,
    est_hours_per_week: Number(p.est_hours_per_week),
  })) as Project[]
}

export async function fetchCapacity(): Promise<CapacitySettings> {
  const { data, error } = await supabase.from('capacity_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return { ...data, weekly_hours_cap: Number(data.weekly_hours_cap) } as CapacitySettings
}
