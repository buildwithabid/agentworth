import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button, Card } from './ui'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Without this, one thrown render error leaves a blank page and no clue.
 * Founders on a phone need something better than that.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
        <Card className="max-w-md">
          <h1 className="font-serif text-xl">Something broke on this screen</h1>
          <p className="mt-2 text-sm text-body">
            Nothing you entered is lost — this is a display fault, not a save fault. Reload, and if
            it keeps happening tell Abid what you were doing.
          </p>
          <p className="mt-3 rounded-lg bg-panel px-3 py-2 font-mono text-xs break-words text-muted">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="quiet"
              onClick={() => {
                window.location.hash = '#/pipeline'
                window.location.reload()
              }}
            >
              Back to Pipeline
            </Button>
          </div>
        </Card>
      </div>
    )
  }
}
