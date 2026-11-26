import { useEffect, useState } from 'react'
import { clearGlobalError, subscribeGlobalErrors, type GlobalError } from './global-errors'

export function GlobalErrorBanner() {
  const [error, setError] = useState<GlobalError | null>(null)
  useEffect(() => subscribeGlobalErrors(setError), [])
  if (!error) return null
  return (
    <div role="alert" data-testid="global-error" className="global-error">
      <span>Something went wrong: {error.message}</span>
      <button type="button" onClick={clearGlobalError}>Dismiss error</button>
    </div>
  )
}
