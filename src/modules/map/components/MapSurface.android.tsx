import { Component, type ReactNode } from 'react'
import { currentMapEngine } from '../lib/engine'
import type { MapSurfaceProps } from '../types'
import { LeafletMapSurface } from './LeafletMapSurface'

const GoogleMapSurface: ((props: MapSurfaceProps) => ReactNode) | null =
  currentMapEngine() === 'google' ? (require('./GoogleMapSurface') as typeof import('./GoogleMapSurface')).GoogleMapSurface : null

// If the Google map fails while it is drawn, the OpenStreetMap map takes over instead of leaving a blank screen.
class Fallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function MapSurface(props: MapSurfaceProps) {
  if (!GoogleMapSurface) return <LeafletMapSurface {...props} />
  return (
    <Fallback fallback={<LeafletMapSurface {...props} />}>
      <GoogleMapSurface {...props} />
    </Fallback>
  )
}
