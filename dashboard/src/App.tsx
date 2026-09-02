import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import type { Route } from './components/Layout'
import SignIn from './components/SignIn'
import Pipeline from './screens/Pipeline'
import Capacity from './screens/Capacity'
import { Loading } from './components/ui'

function currentRoute(): Route {
  return window.location.hash.replace('#/', '') === 'capacity' ? 'capacity' : 'pipeline'
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState<Route>(currentRoute)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!ready) return <Loading />
  if (!session) return <SignIn />

  return (
    <Layout route={route} email={session.user.email ?? ''}>
      {route === 'capacity' ? <Capacity /> : <Pipeline />}
    </Layout>
  )
}
