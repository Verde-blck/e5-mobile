import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { env } from '@/config/env'
import { parseMapEvent } from '../lib/mapEvents'
import { buildMapHtml } from '../lib/mapHtml'
import type { MapSurfaceProps } from '../types'

type MapWindow = Window & { __apply?: (message: object) => void }

/**
 * The map in the browser preview: the same embedded Leaflet page, in an iframe. This is a
 * development convenience; the product is the tablet APK, where MapSurface.tsx runs.
 */
export function MapSurface({
  helmets,
  alarms,
  selectedId,
  fitKey,
  onSelectHelmet,
  onSelectAlarm,
}: MapSurfaceProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const html = useMemo(
    () => buildMapHtml({ tileUrl: env.mapTileUrl, attribution: env.mapAttribution }),
    []
  )

  const handlers = useRef({ onSelectHelmet, onSelectAlarm })
  handlers.current = { onSelectHelmet, onSelectAlarm }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only listen to our own iframe.
      if (event.source !== frame.current?.contentWindow) return
      const message = parseMapEvent((event.data as { __e5map?: unknown } | null)?.__e5map)
      if (!message) return
      if (message.type === 'ready') setReady(true)
      else if (message.type === 'select') handlers.current.onSelectHelmet(message.id)
      else if (message.type === 'deselect') handlers.current.onSelectHelmet(null)
      else handlers.current.onSelectAlarm(message.id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const send = (message: object) => (frame.current?.contentWindow as MapWindow | null)?.__apply?.(message)

  useEffect(() => {
    if (ready) send({ type: 'state', helmets, alarms, selectedId })
  }, [ready, helmets, alarms, selectedId])

  useEffect(() => {
    if (ready && fitKey > 0) send({ type: 'fit' })
  }, [fitKey, ready])

  return (
    <View style={{ flex: 1 }}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: html,
        title: 'Live map',
        style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 },
      })}
    </View>
  )
}
