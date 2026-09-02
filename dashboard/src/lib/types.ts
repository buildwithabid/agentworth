export const STAGES = ['Lead', 'Contacted', 'Scoped', 'Proposal', 'Won', 'Lost'] as const
export type Stage = (typeof STAGES)[number]

/** Stages that count towards open pipeline value. */
export const OPEN_STAGES: Stage[] = ['Lead', 'Contacted', 'Scoped', 'Proposal']

export const OWNERS = ['Ikhtisham', 'Rehbar'] as const
export type Owner = (typeof OWNERS)[number]

export type Deal = {
  id: string
  company: string
  company_key: string
  owner: Owner
  stage: Stage
  value_usd: number
  next_action: string | null
  next_action_date: string | null
  created_at: string
  updated_at: string
  stage_changed_at: string
}

export type Project = {
  id: string
  name: string
  client: string | null
  est_hours_per_week: number
  start_date: string
  end_date: string | null
  status: 'active' | 'done'
  created_at: string
  updated_at: string
}

export type CapacitySettings = {
  id: number
  weekly_hours_cap: number
  updated_at: string
}
