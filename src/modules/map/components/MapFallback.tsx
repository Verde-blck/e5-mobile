import { Component, type ReactNode } from 'react'

// If the native map fails while it is drawn, the OpenStreetMap map takes over instead of leaving a blank screen.
export class MapFallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
