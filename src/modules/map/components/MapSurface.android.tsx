import type { ReactNode } from 'react'
import { currentMapEngine } from '../lib/engine'
import type { MapSurfaceProps } from '../types'
import { LeafletMapSurface } from './LeafletMapSurface'
import { MapFallback } from './MapFallback'

const GoogleMapSurface: ((props: MapSurfaceProps) => ReactNode) | null =
  currentMapEngine() === 'google' ? (require('./NativeMapSurface') as typeof import('./NativeMapSurface')).GoogleMapSurface : null

export function MapSurface(props: MapSurfaceProps) {
  if (!GoogleMapSurface) return <LeafletMapSurface {...props} />
  return (
    <MapFallback fallback={<LeafletMapSurface {...props} />}>
      <GoogleMapSurface {...props} />
    </MapFallback>
  )
}
