import * as React from "react"

import { Button } from "@/components/ui/button"
import { messages } from "@/lib/i18n"

type State = { error: Error | null }

/** Last line of defence: a rendering crash shows a message instead of a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI crashed", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    // Outside the language provider, so it reads the current language directly.
    const t = messages().errorBoundary
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-medium">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.body}
          </p>
          <Button onPress={() => window.location.reload()}>{t.reload}</Button>
        </div>
      </div>
    )
  }
}
