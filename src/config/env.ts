// The one place that reads Expo's public env vars. Nothing else in the app
// should touch process.env directly.
//
// Expo inlines EXPO_PUBLIC_* values at build time by matching the literal
// `process.env.EXPO_PUBLIC_NAME` text, so each one has to be written out in
// full here — reading them through a variable or a loop would silently give
// undefined in a release build.
export const env = {
  // Includes the /api prefix. The web dashboard gets that from the vercel.json
  // rewrite; a phone talks to the backend directly.
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://e5energy-production.up.railway.app/api',
  useMocks: process.env.EXPO_PUBLIC_USE_MOCKS === 'true',
  /** The backend has no push channel for the dashboard, so lists poll. */
  pollIntervalMs: 10_000,
} as const
