export const STAGES = ['Lead', 'Contacted', 'Scoped', 'Proposal', 'Won', 'Lost'] as const
export type Stage = (typeof STAGES)[number]

/** Stages that count towards open pipeline value. */
export const OPEN_STAGES: Stage[] = ['Lead', 'Contacted', 'Scoped', 'Proposal']

export type Role = 'admin' | 'sales' | 'pending'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
  updated_at: string
}

export type Deal = {
  id: string
  company: string
  company_key: string
  owner_id: string
  stage: Stage
  value_usd: number
  next_action: string | null
  next_action_date: string | null
  created_by: string | null
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

export type Settings = {
  id: number
  weekly_hours_cap: number
  approval_threshold_pkr: number
  approval_threshold_usd: number
  updated_at: string
}

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
}

export type Task = {
  id: string
  title: string
  detail: string | null
  assignee_id: string | null
  due_date: string | null
  status: TaskStatus
  created_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ChecklistStep = {
  id: string
  phase: string
  phase_order: number
  phase_when: string | null
  step_order: number
  title: string
  detail: string | null
  meta: string | null
  owner_note: string | null
  owner_id: string | null
  done: boolean
  completed_date: string | null
  created_at: string
  updated_at: string
}

export type Currency = 'USD' | 'PKR'
export const CURRENCIES: Currency[] = ['USD', 'PKR']

export type LedgerEntry = {
  id: string
  entry_date: string
  client: string | null
  amount: number
  currency: Currency
  direction: 'in' | 'out'
  prc_received: boolean
  note: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}
