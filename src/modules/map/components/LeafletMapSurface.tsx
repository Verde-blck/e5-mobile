import { useCallback, useEffect, useMemo, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import WebViewImpl, { type WebViewMessageEvent } from 'react-native-webview'
import { env } from '@/config/env'
import { dispatchMapEvent, parseMapEvent, type MapHandlers } from '../lib/mapEvents'
import { MAP_BASE_URL, buildMapHtml, safeJson } from '../lib/mapHtml'
import type { MapSurfaceProps } from '../types'

// react-native-webview's published prop types intersect its iOS, Android and Windows props,
// which collapses to `never` under this TypeScript version. At runtime nothing is wrong, so
// this declares exactly the props (and the one method) this file uses.
interface MapWebViewProps {
  source: { html: string; baseUrl: string }
  originWhitelist: string[]
  onMessage: (event: WebViewMessageEvent) => void
  onLoadStart: () => void
  onShouldStartLoadWithRequest: (request: { url: string }) => boolean
  javaScriptEnabled: boolean
  domStorageEnabled: boolean
  setSupportMultipleWindows: boolean
  overScrollMode: 'never' | 'always' | 'content'
  style: StyleProp<ViewStyle>
}
interface MapWebViewHandle {
  injectJavaScript: (script: string) => void
}
const MapWebView = WebViewImpl as unknown as ForwardRefExoticComponent<
  MapWebViewProps & RefAttributes<MapWebViewHandle>
>

/**
 * The OpenStreetMap map: the embedded Leaflet page inside a WebView. It is what a tablet shows when the build has no Google
 * Maps key (see MapSurface.android.tsx), and what iOS shows. (The browser preview uses MapSurface.web.tsx, which hosts the very
 * same page in an iframe.)
 *
 * The page is loaded once. Each layer (helmets, fences, a fence being drawn, a route, the
 * playback marker) is sent when, and only when, its own data changes.
 */
export function LeafletMapSurface(props: MapSurfaceProps) {
  const { helmets, alarms, selectedId, fences, selectedFenceId, dimFences, draft, track, cursor, fitKey, fitTarget, fitInsetBottom } = props
  const webview = useRef<MapWebViewHandle>(null)
  const [ready, setReady] = useState(false)
  const html = useMemo(() => buildMapHtml({ tileUrl: env.mapTileUrl, attribution: env.mapAttribution }), [])

  // Read through a ref so a re-render never reloads the page.
  const handlers = useRef<MapHandlers>({})
  handlers.current = {
    onReady: () => setReady(true),
    onSelectHelmet: props.onSelectHelmet,
    onSelectAlarm: props.onSelectAlarm,
    onSelectFence: props.onSelectFence,
    onMapTap: props.onMapTap,
    onDraftChange: props.onDraftChange,
  }

  const send = useCallback((message: object) => {
    webview.current?.injectJavaScript(`window.__apply(${safeJson(message)});true;`)
  }, [])

  useEffect(() => {
    if (ready && helmets) send({ type: 'state', helmets, alarms: alarms ?? [], selectedId: selectedId ?? null })
  }, [ready, helmets, alarms, selectedId, send])

  useEffect(() => {
    if (ready && fences) send({ type: 'fences', fences, selectedId: selectedFenceId ?? null, dim: !!dimFences })
  }, [ready, fences, selectedFenceId, dimFences, send])

  useEffect(() => {
    if (ready && draft !== undefined) send({ type: 'draft', draft })
  }, [ready, draft, send])

  useEffect(() => {
    if (ready && track !== undefined) send({ type: 'track', track, fit: true, inset: fitInsetBottom ?? 0 })
  }, [ready, track, fitInsetBottom, send])

  useEffect(() => {
    if (ready && cursor !== undefined) send({ type: 'cursor', at: cursor })
  }, [ready, cursor, send])

  useEffect(() => {
    if (ready && (fitKey ?? 0) > 0) send({ type: 'fit', target: fitTarget ?? 'all', inset: fitInsetBottom ?? 0 })
  }, [ready, fitKey, fitTarget, send])

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseMapEvent(event.nativeEvent.data)
    if (message) dispatchMapEvent(message, handlers.current)
  }, [])

  return (
    <MapWebView
      ref={webview}
      source={{ html, baseUrl: MAP_BASE_URL }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onLoadStart={() => setReady(false)}
      // Nothing in the map should navigate the WebView away from itself.
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith(MAP_BASE_URL)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      style={{ flex: 1, backgroundColor: '#E5E7EB' }}
    />
  )
}
