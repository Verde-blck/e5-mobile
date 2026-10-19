import { useCallback, useEffect, useMemo, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import WebViewImpl, { type WebViewMessageEvent } from 'react-native-webview'
import { env } from '@/config/env'
import { parseMapEvent } from '../lib/mapEvents'
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
 * The map on a tablet: the embedded Leaflet page inside a WebView.
 * (The browser preview uses MapSurface.web.tsx, which hosts the very same page in an iframe.)
 */
export function MapSurface({
  helmets,
  alarms,
  selectedId,
  fitKey,
  onSelectHelmet,
  onSelectAlarm,
}: MapSurfaceProps) {
  const webview = useRef<MapWebViewHandle>(null)
  const [ready, setReady] = useState(false)
  const html = useMemo(
    () => buildMapHtml({ tileUrl: env.mapTileUrl, attribution: env.mapAttribution }),
    []
  )

  // The page is loaded once; the latest callbacks are read through a ref so a re-render
  // never reloads it.
  const handlers = useRef({ onSelectHelmet, onSelectAlarm })
  handlers.current = { onSelectHelmet, onSelectAlarm }

  const send = useCallback((message: object) => {
    webview.current?.injectJavaScript(`window.__apply(${safeJson(message)});true;`)
  }, [])

  useEffect(() => {
    if (ready) send({ type: 'state', helmets, alarms, selectedId })
  }, [ready, helmets, alarms, selectedId, send])

  useEffect(() => {
    if (ready && fitKey > 0) send({ type: 'fit' })
  }, [fitKey, ready, send])

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseMapEvent(event.nativeEvent.data)
    if (!message) return
    if (message.type === 'ready') setReady(true)
    else if (message.type === 'select') handlers.current.onSelectHelmet(message.id)
    else if (message.type === 'deselect') handlers.current.onSelectHelmet(null)
    else handlers.current.onSelectAlarm(message.id)
  }, [])

  return (
    <MapWebView
      ref={webview}
      source={{ html, baseUrl: MAP_BASE_URL }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onLoadStart={() => setReady(false)}
      // Nothing in the map should navigate the WebView away from itself.
      onShouldStartLoadWithRequest={(request) =>
        request.url === 'about:blank' || request.url.startsWith(MAP_BASE_URL)
      }
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      style={{ flex: 1, backgroundColor: '#E5E7EB' }}
    />
  )
}
