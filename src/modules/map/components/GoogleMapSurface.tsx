import { forwardRef, useCallback, useEffect, useRef, useState, type ComponentProps, type ElementRef } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import MapView, { Circle, Marker, Polygon, Polyline, PROVIDER_GOOGLE, type MapPressEvent } from 'react-native-maps'
import { env } from '@/config/env'
import type { LatLng } from '@/modules/fences/types'
import {
  ALARM_PIN_Z, COLOURS, CURSOR_Z, accuracyStyle, draftStyle, edgePadding, fenceAt, fenceStyle, fitCoordinates, helmetLook, helmetZ, nearEdgeOrOff, toCoordinate, withAlpha, withMinSpan,
  type Coordinate,
} from '../lib/nativeMap'
import type { MapFitTarget, MapHelmet, MapSurfaceProps } from '../types'

/*
 * The map on an Android tablet when the build has a Google Maps key: Google's own map, drawn natively, showing exactly what the
 * Leaflet map shows (helmets, alarm pins, fences, a fence being drawn, a route and its playback marker) behind the same
 * MapSurfaceProps, so the Live Map, the fence editor and track playback don't know which one they have.
 *
 * What to draw and how to frame it are the plain functions in lib/nativeMap.ts, which have their own tests. This file only turns
 * them into map elements.
 */

// Lagos, wide enough to see the region until the first helmets arrive (the Leaflet map's start, at the same zoom).
const START = { center: { latitude: 6.4474, longitude: 3.4012 }, zoom: 11, heading: 0, pitch: 0, altitude: 0 }

type MarkerRef = ElementRef<typeof Marker>

/**
 * A marker drawn from ordinary views. The map turns such a view into a picture once and then stops watching it (watching every
 * marker all the time makes a map crawl), so it is asked to look again for a moment whenever `look` changes.
 */
const BitmapMarker = forwardRef<MarkerRef, ComponentProps<typeof Marker> & { look: string }>(function BitmapMarker({ look, children, ...props }, ref) {
  const [watching, setWatching] = useState(true)
  useEffect(() => {
    setWatching(true)
    const timer = setTimeout(() => setWatching(false), 500)
    return () => clearTimeout(timer)
  }, [look])
  return (
    <Marker ref={ref} {...props} tracksViewChanges={watching}>
      {children}
    </Marker>
  )
})

const ring = (size: number, colour: string, width: number) => ({ position: 'absolute' as const, width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: colour })

function HelmetPin({ helmet, selected }: { helmet: Pick<MapHelmet, 'presence' | 'alarm'>; selected: boolean }) {
  return (
    <View style={styles.centred30}>
      {helmet.alarm ? <View style={ring(30, helmet.alarm === 'critical' ? COLOURS.critical : COLOURS.warning, 3)} /> : null}
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: selected ? COLOURS.deep : '#FFFFFF', backgroundColor: COLOURS[helmet.presence], transform: [{ scale: selected ? 1.4 : 1 }] }} />
    </View>
  )
}

function AlarmPin({ severity }: { severity: 'critical' | 'warning' }) {
  return (
    <View style={{ width: 26, height: 34, alignItems: 'center' }}>
      <View style={{ width: 20, height: 20, marginTop: 4, borderRadius: 10, borderBottomLeftRadius: 0, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: severity === 'critical' ? COLOURS.critical : COLOURS.warning, transform: [{ rotate: '-45deg' }] }} />
    </View>
  )
}

function Handle({ label, colour }: { label: string; colour: string }) {
  return (
    <View style={[styles.centred30, { backgroundColor: colour, borderRadius: 15, borderWidth: 3, borderColor: '#FFFFFF' }]}>
      <Text style={styles.handleText}>{label}</Text>
    </View>
  )
}

function EndPin({ letter, colour }: { letter: string; colour: string }) {
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={styles.handleText}>{letter}</Text>
    </View>
  )
}

const CursorPin = () => <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: COLOURS.cursor, outlineColor: COLOURS.cursorRing }} />
const DotPin = () => <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: COLOURS.route, backgroundColor: COLOURS.route }} />

export function GoogleMapSurface(props: MapSurfaceProps) {
  const { helmets, alarms, selectedId, fences, selectedFenceId, dimFences, draft, track, cursor, fitKey, fitTarget, fitInsetBottom } = props
  const mapRef = useRef<MapView>(null)
  const markers = useRef<Record<string, MarkerRef | null>>({})
  const [ready, setReady] = useState(false)
  // The newest props, for handlers that outlive a render (a tap, a timer) and must never act on old ones.
  const latest = useRef(props)
  latest.current = props
  const fitted = useRef(false)
  const lastSelected = useRef<string | null>(null)
  const refitUntil = useRef(0)
  const lastFollow = useRef(0)
  // While a handle is being dragged, the shape follows it here; a new draft from the screen replaces this.
  const [live, setLive] = useState<{ center?: LatLng; points?: LatLng[] } | null>(null)
  useEffect(() => setLive(null), [draft])

  const frame = useCallback((target: MapFitTarget, inset: number) => {
    const p = latest.current
    const coordinates = fitCoordinates(target, { helmets: p.helmets, alarms: p.alarms, fences: p.fences, draft: p.draft, track: p.track })
    if (coordinates.length === 0) return
    mapRef.current?.fitToCoordinates(withMinSpan(coordinates), { edgePadding: edgePadding(target, inset), animated: true })
  }, [])

  // Bring a point back into view, but only if it is near the edge or off screen, so the map doesn't jump while you watch.
  const keepInView = useCallback((at: Coordinate, margin: number) => {
    void mapRef.current
      ?.getMapBoundaries()
      .then((bounds) => {
        if (nearEdgeOrOff(at, bounds, margin)) mapRef.current?.animateCamera({ center: at }, { duration: 400 })
      })
      .catch(() => undefined)
  }, [])

  // The first time there is something to show, frame it.
  useEffect(() => {
    if (ready && !fitted.current && ((helmets?.length ?? 0) > 0 || (alarms?.length ?? 0) > 0)) {
      fitted.current = true
      frame('all', 0)
    }
  }, [ready, helmets, alarms, frame])

  // Choosing a helmet brings it into view and shows its name; a helmet already on screen isn't moved.
  useEffect(() => {
    if (!ready) return
    const previous = lastSelected.current
    if (previous && previous !== selectedId) markers.current[previous]?.hideCallout()
    if (selectedId && selectedId !== previous) {
      const helmet = helmets?.find((h) => h.id === selectedId)
      if (helmet) {
        keepInView({ latitude: helmet.lat, longitude: helmet.lng }, 0.2)
        markers.current[selectedId]?.showCallout()
      }
    }
    lastSelected.current = selectedId ?? null
  }, [ready, selectedId, helmets, keepInView])

  // A new route is framed. The screen's layout often settles just after the first frame (the playback bar appears), so it is framed
  // again if the map changes size in the next couple of seconds, until the person touches the map.
  useEffect(() => {
    if (!ready || track === undefined) return
    refitUntil.current = Date.now() + 2500
    const timer = setTimeout(() => frame('track', fitInsetBottom ?? 0), 150)
    return () => clearTimeout(timer)
  }, [ready, track, fitInsetBottom, frame])

  useEffect(() => {
    if (ready && (fitKey ?? 0) > 0) frame(fitTarget ?? 'all', fitInsetBottom ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey])

  // The playback marker is kept on screen without re-framing, checked at most twice a second.
  useEffect(() => {
    if (!ready || !cursor || Date.now() - lastFollow.current < 500) return
    lastFollow.current = Date.now()
    keepInView(toCoordinate(cursor), 0.1)
  }, [ready, cursor, keepInView])

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (Date.now() < refitUntil.current) frame('track', latest.current.fitInsetBottom ?? 0)
    },
    [frame]
  )

  const onPress = useCallback((event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate
    const p = latest.current
    // Drawing a fence: a tap places its centre or a corner.
    if (p.draft) return p.onMapTap?.(latitude, longitude)
    // Otherwise a tap inside a saved fence selects it, and a tap on bare map clears the selection.
    const hit = p.fences && !p.dimFences ? fenceAt({ lat: latitude, lng: longitude }, p.fences) : null
    if (hit !== null) p.onSelectFence?.(hit)
    else p.onSelectHelmet?.(null)
  }, [])

  const draftLook = draft ? draftStyle(draft) : null

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        // With a Map ID the map takes the dashboard's style; without one it is Google's standard map.
        {...(env.googleMapId ? { googleMapId: env.googleMapId, googleRenderer: 'LATEST' as const } : {})}
        initialCamera={START}
        minZoomLevel={3}
        maxZoomLevel={19}
        toolbarEnabled={false}
        zoomControlEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        moveOnMarkerPress={false}
        onMapReady={() => setReady(true)}
        onPress={onPress}
        onPanDrag={() => {
          refitUntil.current = 0
        }}
      >
        {/* saved fences, under everything */}
        {fences?.map((fence) => {
          const style = fenceStyle(fence, fence.id === selectedFenceId, !!dimFences)
          if (fence.type === 'ROUND' && fence.center) return <Circle key={`fence-${fence.id}`} center={toCoordinate(fence.center)} radius={fence.radiusMeters} strokeColor={style.stroke} fillColor={style.fill} strokeWidth={style.width} zIndex={1} />
          if (fence.type === 'POLYGON' && fence.points.length >= 3) return <Polygon key={`fence-${fence.id}`} coordinates={fence.points.map(toCoordinate)} strokeColor={style.stroke} fillColor={style.fill} strokeWidth={style.width} zIndex={1} />
          return null
        })}

        {/* how sure each helmet's position is */}
        {helmets?.map((helmet) => {
          const style = accuracyStyle(helmet, helmet.id === selectedId)
          return style ? <Circle key={`accuracy-${helmet.id}`} center={{ latitude: helmet.lat, longitude: helmet.lng }} radius={style.radius} strokeColor={style.stroke} fillColor={style.fill} strokeWidth={style.width} lineDashPattern={style.dash} zIndex={2} /> : null
        })}

        {/* the fence being drawn */}
        {draft && draftLook && draft.type === 'ROUND' && (live?.center ?? draft.center) ? (
          <>
            <Circle center={toCoordinate(live?.center ?? (draft.center as LatLng))} radius={draft.radiusMeters} strokeColor={draftLook.stroke} fillColor={draftLook.fill} strokeWidth={draftLook.width} zIndex={3} />
            <BitmapMarker
              look={draftLook.colour}
              coordinate={toCoordinate(live?.center ?? (draft.center as LatLng))}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={900}
              draggable
              onDrag={(e) => setLive({ center: { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude } })}
              onDragEnd={(e) => {
                const center = { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }
                setLive({ center })
                latest.current.onDraftChange?.({ center })
              }}
            >
              <Handle label="" colour={draftLook.colour} />
            </BitmapMarker>
          </>
        ) : null}
        {draft && draftLook && draft.type === 'POLYGON'
          ? (() => {
              const points = live?.points ?? draft.points
              return (
                <>
                  {points.length >= 3 ? <Polygon coordinates={points.map(toCoordinate)} strokeColor={draftLook.stroke} fillColor={draftLook.fill} strokeWidth={draftLook.width} zIndex={3} /> : null}
                  {points.length === 2 ? <Polyline coordinates={points.map(toCoordinate)} strokeColor={withAlpha(draftLook.colour, 1)} strokeWidth={3} lineDashPattern={[6, 6]} zIndex={3} /> : null}
                  {points.map((point, i) => (
                    <BitmapMarker
                      key={`corner-${i}`}
                      look={`${i}|${draftLook.colour}`}
                      coordinate={toCoordinate(point)}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={900}
                      draggable
                      onDrag={(e) => setLive({ points: points.map((p, j) => (j === i ? { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude } : p)) })}
                      onDragEnd={(e) => {
                        const next = points.map((p, j) => (j === i ? { lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude } : p))
                        setLive({ points: next })
                        latest.current.onDraftChange?.({ points: next })
                      }}
                    >
                      <Handle label={String(i + 1)} colour={draftLook.colour} />
                    </BitmapMarker>
                  ))}
                </>
              )
            })()
          : null}

        {/* a route, one line per continuous run, so no line crosses a gap in coverage */}
        {track?.segments.map((segment, i) =>
          segment.length > 1 ? (
            <Polyline key={`run-${i}`} coordinates={segment.map(toCoordinate)} strokeColor={withAlpha(COLOURS.route, 0.85)} strokeWidth={4} lineCap="round" lineJoin="round" zIndex={4} />
          ) : segment.length === 1 ? (
            <BitmapMarker key={`run-${i}`} look="dot" coordinate={toCoordinate(segment[0])} anchor={{ x: 0.5, y: 0.5 }} zIndex={4} tappable={false}>
              <DotPin />
            </BitmapMarker>
          ) : null
        )}
        {track?.start ? (
          <BitmapMarker look="A" coordinate={toCoordinate(track.start)} anchor={{ x: 0.5, y: 0.5 }} zIndex={5} tappable={false}>
            <EndPin letter="A" colour={COLOURS.start} />
          </BitmapMarker>
        ) : null}
        {track?.end ? (
          <BitmapMarker look="B" coordinate={toCoordinate(track.end)} anchor={{ x: 0.5, y: 0.5 }} zIndex={5} tappable={false}>
            <EndPin letter="B" colour={COLOURS.end} />
          </BitmapMarker>
        ) : null}
        {cursor ? (
          <BitmapMarker look="cursor" coordinate={toCoordinate(cursor)} anchor={{ x: 0.5, y: 0.5 }} zIndex={CURSOR_Z} tappable={false}>
            <CursorPin />
          </BitmapMarker>
        ) : null}

        {/* alarm pins, above the fences, below the selected helmet */}
        {alarms?.map((alarm) => (
          <BitmapMarker
            key={`alarm-${alarm.id}`}
            look={alarm.severity}
            coordinate={{ latitude: alarm.lat, longitude: alarm.lng }}
            anchor={{ x: 0.5, y: 0.9 }}
            zIndex={ALARM_PIN_Z}
            title={`${alarm.label}, ${alarm.deviceName}`}
            onPress={() => latest.current.onSelectAlarm?.(alarm.id)}
          >
            <AlarmPin severity={alarm.severity} />
          </BitmapMarker>
        ))}

        {/* helmets: coloured by whether they are reporting, ringed when they have an alarm; the selected one is larger and named */}
        {helmets?.map((helmet) => {
          const selected = helmet.id === selectedId
          return (
            <BitmapMarker
              key={`helmet-${helmet.id}`}
              ref={(r) => {
                markers.current[helmet.id] = r
              }}
              look={helmetLook(helmet, selected)}
              coordinate={{ latitude: helmet.lat, longitude: helmet.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={helmet.name}
              zIndex={helmetZ(helmet, selected)}
              onPress={() => latest.current.onSelectHelmet?.(helmet.id)}
            >
              <HelmetPin helmet={helmet} selected={selected} />
            </BitmapMarker>
          )
        })}
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#E5E7EB' },
  centred30: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  handleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
})
