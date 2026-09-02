import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import type { Profile, Role } from '../lib/types'
import { shortDate } from '../lib/format'
import {
  Avatar,
  Badge,
  Card,
  Label,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

const ROLE_NOTE: Record<Role, string> = {
  admin: 'Everything: the cap, projects, the ledger, every deal, the checklist and roles.',
  sales: 'Their own deals. Reads the whole pipeline, the ledger and capacity. Cannot change them.',
  pending: 'No access at all until you give them a role.',
}

export default function Team() {
  const { team, me, reloadTeam } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function setRole(p: Profile, role: Role) {
    setBusy(p.id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    setBusy(null)
    if (error) toast.bad(error.message)
    else {
      toast.ok(`${p.full_name} is now ${role}`)
      await reloadTeam()
    }
  }

  const admins = team.filter((p) => p.role === 'admin').length

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Who can do what. Roles take effect immediately — they are enforced by the database, not just hidden in this screen."
      />

      <div className="space-y-3">
        {team.map((p) => {
          const isMe = p.id === me?.id
          const lastAdmin = p.role === 'admin' && admins <= 1
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={p.full_name} you={isMe} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.full_name}
                    {isMe && <span className="text-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.role === 'admin' ? 'accent' : p.role === 'sales' ? 'neutral' : 'warn'}>
                    {p.role}
                  </Badge>
                  <Select
                    value={p.role}
                    disabled={busy === p.id || lastAdmin}
                    title={lastAdmin ? 'You cannot remove the only admin' : undefined}
                    onChange={(e) => void setRole(p, e.target.value as Role)}
                    className="w-32"
                  >
                    <option value="admin">admin</option>
                    <option value="sales">sales</option>
                    <option value="pending">pending</option>
                  </Select>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-body">{ROLE_NOTE[p.role]}</p>
              <p className="mt-1 text-[11px] text-muted">Added {shortDate(p.created_at.slice(0, 10))}</p>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6 bg-panel">
        <Label>Adding someone</Label>
        <p className="mt-2 text-sm text-body">
          Create the account in the Supabase dashboard under Authentication → Users, ticking “Auto
          Confirm User”. They appear here as <span className="font-medium">pending</span> with no
          access to anything, and stay that way until you give them a role.
        </p>
        <p className="mt-2 text-sm text-body">
          Removing someone is the reverse: set them back to <span className="font-medium">pending</span>{' '}
          and they are locked out immediately, without deleting anything they entered.
        </p>
      </Card>
    </div>
  )
}
