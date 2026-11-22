import type { ReactNode } from 'react'
import { currentMapEngine } from '../lib/engine'
import type { MapSurfaceProps } from '../types'
import { LeafletMapSurface } from './LeafletMapSurface'
import { MapFallback } from './MapFallback'

const AppleMapSurface: ((props: MapSurfaceProps) => ReactNode) | null =
  currentMapEngine() === 'apple' ? (require('./NativeMapSurface') as typeof import('./NativeMapSurface')).AppleMapSurface : null

export function MapSurface(props: MapSurfaceProps) {
  if (!AppleMapSurface) return <LeafletMapSurface {...props} />
  return (
    <MapFallback fallback={<LeafletMapSurface {...props} />}>
      <AppleMapSurface {...props} />
    </MapFallback>
  )
}
