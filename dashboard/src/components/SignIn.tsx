import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorBanner, Field, Input } from './ui'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="mb-1 font-serif text-2xl">Agentworth</h1>
        <p className="mb-6 text-sm text-body">Internal dashboard.</p>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  )
}
