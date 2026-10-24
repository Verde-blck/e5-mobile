// The one place that reads Expo's public env vars. Nothing else in the app
// should touch process.env directly.
//
// Expo inlines EXPO_PUBLIC_* values at build time by matching the literal
// `process.env.EXPO_PUBLIC_NAME` text, so each one has to be written out in
// full here — reading them through a variable or a loop would silently give
// undefined in a release build.
/**
 * A switch written the way people write them: true, True, TRUE, 1, yes, on, with spaces or quotes around it. The
 * old exact match on the text `true` quietly counted `True` or `"true"` as off, which looks like a feature that
 * has vanished. Anything else, and nothing at all, is off.
 */
export function parseFlag(value: string | undefined): boolean {
  return /^(true|1|yes|on)$/i.test((value ?? '').trim().replace(/^["']|["']$/g, '').trim())
}

/** A switch that is ON when it isn't set: only the words that mean off (false, 0, no, off) turn it off. */
export function flagOr(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
  if (v === '') return fallback
  return !['false', '0', 'no', 'off'].includes(v)
}

/**
 * A Google Map ID from the environment, or undefined. Map IDs are hexadecimal; the value is trimmed first, because a stray space at
 * the end of a pasted setting (easy to do, invisible to see) would otherwise make Google quietly ignore the ID.
 */
export function cleanMapId(value: string | undefined): string | undefined {
  const id = (value ?? '').trim().replace(/^["']|["']$/g, '').trim()
  return /^[0-9a-f]{16,40}$/i.test(id) ? id : undefined
}

export const env = {
  // Includes the /api prefix. The web dashboard gets that from the vercel.json
  // rewrite; a phone talks to the backend directly.
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://e5energy-production.up.railway.app/api',
  useMocks: parseFlag(process.env.EXPO_PUBLIC_USE_MOCKS),
  // The map tiles. The default is OpenStreetMap's public server, fine for development and
  // light use; its usage policy doesn't suit a fleet in daily use. For production, point this
  // at a tile provider E5 has an account with (or any {z}/{x}/{y} raster URL).
  mapTileUrl:
    process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution:
    process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors',
  // Phones are kept out: the app shows only "This app is for tablets" on an Android screen under 600 dp. On unless this is set to
  // false (for testing on a phone). Only an Android build is affected; the browser preview never is (docs/TABLETS_ONLY.md).
  tabletOnly: flagOr(process.env.EXPO_PUBLIC_TABLET_ONLY, true),
  // The Google map on the tablet (docs/GOOGLE_MAPS.md). The key itself is a build setting (GOOGLE_MAPS_ANDROID_API_KEY, see
  // app.config.js); the Map ID, which gives the map the dashboard's style, is optional, and with none the map is Google's standard one.
  googleMapId: cleanMapId(process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID),
  // Set to "osm" to use the OpenStreetMap map even in a build that has a Google key: the way back if the Google map ever misbehaves.
  mapEngine: process.env.EXPO_PUBLIC_MAP_ENGINE,
  // Push alerts for a locked tablet. Off until the backend can register tablets and send the push
  // (see docs/PUSH_SETUP.md); while off, the app says plainly that alerts need the app to be open.
  pushEnabled: parseFlag(process.env.EXPO_PUBLIC_PUSH_ENABLED),
  // Live view and calls with a helmet (WebRTC). Written to the web's own protocol but not yet tried on a real tablet
  // with a real helmet, so a real build keeps them hidden until this is true (docs/CALLS.md). Sample data mode has them.
  liveEnabled: parseFlag(process.env.EXPO_PUBLIC_LIVE_ENABLED),
  /** The backend has no push channel for the dashboard, so lists poll. */
  pollIntervalMs: 10_000,
} as const
