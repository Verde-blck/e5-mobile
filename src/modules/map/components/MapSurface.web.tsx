import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { env } from '@/config/env'
import { dispatchMapEvent, parseMapEvent, type MapHandlers } from '../lib/mapEvents'
import { buildMapHtml } from '../lib/mapHtml'
import type { MapSurfaceProps } from '../types'

type MapWindow = Window & { __apply?: (message: object) => void }

export function MapSurface(props: MapSurfaceProps) {
  const { helmets, alarms, selectedId, fences, selectedFenceId, dimFences, draft, track, cursor, fitKey, fitTarget, fitInsetBottom } = props
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const html = useMemo(() => buildMapHtml({ tileUrl: env.mapTileUrl, attribution: env.mapAttribution }), [])

  const handlers = useRef<MapHandlers>({})
  handlers.current = {
    onReady: () => setReady(true),
    onSelectHelmet: props.onSelectHelmet,
    onSelectAlarm: props.onSelectAlarm,
    onSelectFence: props.onSelectFence,
    onMapTap: props.onMapTap,
    onDraftChange: props.onDraftChange,
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const message = parseMapEvent((event.data as { __e5map?: unknown } | null)?.__e5map)
      if (message) dispatchMapEvent(message, handlers.current)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const send = (message: object) => (frame.current?.contentWindow as MapWindow | null)?.__apply?.(message)

  useEffect(() => {
    if (ready && helmets) send({ type: 'state', helmets, alarms: alarms ?? [], selectedId: selectedId ?? null })
  }, [ready, helmets, alarms, selectedId])

  useEffect(() => {
    if (ready && fences) send({ type: 'fences', fences, selectedId: selectedFenceId ?? null, dim: !!dimFences })
  }, [ready, fences, selectedFenceId, dimFences])

  useEffect(() => {
    if (ready && draft !== undefined) send({ type: 'draft', draft })
  }, [ready, draft])

  useEffect(() => {
    if (ready && track !== undefined) send({ type: 'track', track, fit: true, inset: fitInsetBottom ?? 0 })
  }, [ready, track, fitInsetBottom])

  useEffect(() => {
    if (ready && cursor !== undefined) send({ type: 'cursor', at: cursor })
  }, [ready, cursor])

  useEffect(() => {
    if (ready && (fitKey ?? 0) > 0) send({ type: 'fit', target: fitTarget ?? 'all', inset: fitInsetBottom ?? 0 })
  }, [ready, fitKey, fitTarget])

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
