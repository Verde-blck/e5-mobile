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
  // Push alerts for a locked tablet. Off until the backend can register tablets and send the push
  // (see docs/PUSH_SETUP.md); while off, the app says plainly that alerts need the app to be open.
  pushEnabled: parseFlag(process.env.EXPO_PUBLIC_PUSH_ENABLED),
  // Voice messages to several helmets (POST /api/broadcast). Off in a real build until the request has been
  // checked against the backend (docs/GROUP_CALL.md); sample data mode always has it.
  broadcastEnabled: parseFlag(process.env.EXPO_PUBLIC_BROADCAST_ENABLED),
  // Live view and calls with a helmet (WebRTC). Written to the web's own protocol but not yet tried on a real tablet
  // with a real helmet, so a real build keeps them hidden until this is true (docs/CALLS.md). Sample data mode has them.
  liveEnabled: parseFlag(process.env.EXPO_PUBLIC_LIVE_ENABLED),
  /** The backend has no push channel for the dashboard, so lists poll. */
  pollIntervalMs: 10_000,
} as const
