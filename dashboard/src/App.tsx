import { lazy, Suspense, useEffect, useState } from 'react'
import { SessionProvider, useSession } from './lib/session'
import Layout, { ROUTES } from './components/Layout'
import type { Route } from './components/Layout'
import SignIn from './components/SignIn'
import Pending from './components/Pending'
import ErrorBoundary from './components/ErrorBoundary'
import { LoadingScreen, ToastProvider } from './components/ui'

// Split per screen: the Monday meeting does not need the ledger's code to open.
const Pipeline = lazy(() => import('./screens/Pipeline'))
const Capacity = lazy(() => import('./screens/Capacity'))
const Tasks = lazy(() => import('./screens/Tasks'))
const Ledger = lazy(() => import('./screens/Ledger'))
const Checklist = lazy(() => import('./screens/Checklist'))
const Documents = lazy(() => import('./screens/Documents'))
const Weekly = lazy(() => import('./screens/Weekly'))
const Team = lazy(() => import('./screens/Team'))

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
    case 'documents':
      return <Documents />
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
    const onHash = () => {
      setRoute(currentRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!ready)
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-7">
        <LoadingScreen />
      </div>
    )
  if (!session) return <SignIn />
  if (role === 'pending') return <Pending />

  // a sales user who bookmarks /team gets sent back rather than shown nothing
  const safe: Route = route === 'team' && !isAdmin ? 'pipeline' : route

  return (
    <Layout route={safe}>
      <Suspense fallback={<LoadingScreen />}>
        <Screen route={safe} />
      </Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
