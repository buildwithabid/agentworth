import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { Button, Card } from './ui'

/**
 * A signed-in account with no role. Every table refuses it, so rather than
 * showing empty screens that look broken, say plainly what is missing.
 */
export default function Pending() {
  const { session } = useSession()
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <Card className="max-w-md text-center">
        <h1 className="font-serif text-xl">This account has no access yet</h1>
        <p className="mt-2 text-sm text-body">
          You are signed in as{' '}
          <span className="font-medium text-ink">{session?.user.email}</span>, but no role has been
          assigned to it. Ask Abid to add you on the Team screen.
        </p>
        <Button variant="quiet" className="mt-5" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}
