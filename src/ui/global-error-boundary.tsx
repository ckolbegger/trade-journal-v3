import { Component, type ReactNode } from 'react'
import { reportGlobalError } from './global-errors'

type Props = { children: ReactNode }
type State = { failed: boolean }

// Catches render/lifecycle errors that window listeners cannot see. The banner
// lives outside this boundary, so it survives the fallback render.
export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error): void {
    reportGlobalError({ message: error.message, source: 'render' })
  }

  render(): ReactNode {
    if (this.state.failed) return <p role="status">The screen could not be rendered. See the error banner above.</p>
    return this.props.children
  }
}
