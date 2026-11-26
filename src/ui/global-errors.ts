import { messageFor } from './error-meaning'

// Last-resort error surface. React error boundaries do not see rejections
// from async event handlers (`void onSave()`), so the window listeners below
// catch anything uncaught anywhere in the app and make it visible rather than
// leaving a dead button with no explanation.
export type GlobalError = { message: string; source: 'unhandled' | 'render' }

type Listener = (error: GlobalError | null) => void
let current: GlobalError | null = null
const listeners = new Set<Listener>()
let installed = false

export function reportGlobalError(error: GlobalError): void {
  current = error
  for (const listener of listeners) listener(current)
}

export function clearGlobalError(): void {
  current = null
  for (const listener of listeners) listener(null)
}

export function subscribeGlobalErrors(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => { listeners.delete(listener) }
}

export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  // Resource failures (e.g. favicon 404) target the element, not the window.
  window.addEventListener('error', event => {
    if (event.target !== window) return
    reportGlobalError({
      message: messageFor(event.message || new Error('Unexpected error')),
      source: 'unhandled',
    })
  })

  window.addEventListener('unhandledrejection', event => {
    const reason: unknown = event.reason
    reportGlobalError({ message: messageFor(reason), source: 'unhandled' })
  })
}
