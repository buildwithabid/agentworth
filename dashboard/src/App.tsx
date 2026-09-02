import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './lib/session'
import Layout, { ROUTES } from './components/Layout'
import type { Route } from './components/Layout'
import SignIn from './components/SignIn'
import Pending from './components/Pending'
import { LoadingScreen, ToastProvider } from './components/ui'
import Pipeline from './screens/Pipeline'
import Capacity from './screens/Capacity'
import Tasks from './screens/Tasks'
import Ledger from './screens/Ledger'
import Checklist from './screens/Checklist'
import Weekly from './screens/Weekly'
import Team from './screens/Team'

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(hash) ? hash : 'pipeline'
}

function Screen({ route }: { route: Route }) {
  switch (route) {
    case 'capacity':
      return <Capacity />
    case 'tasks':
      return <Tasks />
    case 'ledger':
      return <Ledger />
    case 'checklist':
      return <Checklist />
    case 'weekly':
      return <Weekly />
    case 'team':
      return <Team />
    default:
      return <Pipeline />
  }
}

function Shell() {
  const { session, ready, role, isAdmin } = useSession()
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!ready)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoadingScreen />
      </div>
    )
  if (!session) return <SignIn />
  if (role === 'pending') return <Pending />

  // a sales user who bookmarks /team gets sent back rather than shown nothing
  const safe: Route = route === 'team' && !isAdmin ? 'pipeline' : route

  return (
    <Layout route={safe}>
      <Screen route={safe} />
    </Layout>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </ToastProvider>
  )
}
