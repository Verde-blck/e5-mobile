// Expo inlines EXPO_PUBLIC_* values by matching the literal `process.env.EXPO_PUBLIC_NAME` text, so each
// must be written out in full: reading them through a variable or loop would silently give undefined.
// Accepts the ways people write a switch (true, True, 1, yes, on, with spaces or quotes): the old exact
// match on `true` quietly counted `True` as off, which looked like a feature that didn't work.
export function parseFlag(value: string | undefined): boolean {
  return /^(true|1|yes|on)$/i.test((value ?? '').trim().replace(/^["']|["']$/g, '').trim())
}

export function flagOr(value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
  if (v === '') return fallback
  return !['false', '0', 'no', 'off'].includes(v)
}

// The privacy policy E5 published; the same address is set in Google Play Console.
export const DEFAULT_PRIVACY_POLICY_URL = 'https://e5energyng.com/privacy-policy/'

/** A secure web address, with the quotes and spaces a pasted setting tends to carry removed. Anything else is not used. */
export function cleanHttpsUrl(value: string | undefined): string | undefined {
  const v = (value ?? '').trim().replace(/^["']|["']$/g, '').trim()
  return /^https:\/\/[^\s/]+\S*$/i.test(v) ? v : undefined
}

// Trimmed first: a stray space at the end of a pasted setting is
// invisible and would make Google quietly ignore the ID.
export function cleanMapId(value: string | undefined): string | undefined {
  const id = (value ?? '').trim().replace(/^["']|["']$/g, '').trim()
  return /^[0-9a-f]{16,40}$/i.test(id) ? id : undefined
}

// What a developer's copy uses when nothing is set, so it runs with no set-up. A release build never falls back to it.
export const DEFAULT_API_BASE_URL = 'https://e5energy-production.up.railway.app/api'

export interface ApiBaseUrl {
  url: string
  problem: string | null
}

/**
 * The server address the app talks to, tidied: quotes, spaces and trailing slashes removed, because paths are joined onto it. A release
 * build has to be given a secure address, and says so plainly when it has none or a bad one, rather than quietly using a default
 * or starting with an address that cannot work. Sample-data builds never contact a server, so they have nothing to complain about.
 */
export function resolveApiBaseUrl(raw: string | undefined, { release, useMocks }: { release: boolean; useMocks: boolean }): ApiBaseUrl {
  const url = (raw ?? '').trim().replace(/^["']|["']$/g, '').trim().replace(/\/+$/, '')
  if (url === '') {
    if (!release) return { url: DEFAULT_API_BASE_URL, problem: null }
    return {
      url: '',
      problem: useMocks ? null : 'This build has no server address. It was built without the EXPO_PUBLIC_API_BASE_URL setting, so it does not know which E5 server to talk to.',
    }
  }
  const valid = new RegExp(`^${release ? 'https' : 'https?'}://[^\\s/?#]+(/[^\\s?#]*)?$`, 'i').test(url)
  if (valid || useMocks) return { url, problem: null }
  const shown = url.length > 80 ? `${url.slice(0, 77)}...` : url
  return { url, problem: `The server address in this build, "${shown}", is not valid. It must be a full address that starts with ${release ? 'https://' : 'http:// or https://'}, for example https://example.com/api.` }
}

const useMocks = parseFlag(process.env.EXPO_PUBLIC_USE_MOCKS)
const api = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, { release: process.env.NODE_ENV === 'production', useMocks })

export const env = {
  apiBaseUrl: api.url,
  // Set when this build cannot work as configured. The app then shows that instead of starting.
  configProblem: api.problem,
  useMocks,
  // The default is OpenStreetMap's public server: fine for development, but its usage policy doesn't suit
  // a fleet in daily use. For production, point this at a tile provider E5 has an account with.
  mapTileUrl:
    process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution:
    process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors',
  tabletOnly: flagOr(process.env.EXPO_PUBLIC_TABLET_ONLY, true),
  googleMapId: cleanMapId(process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID),
  mapEngine: process.env.EXPO_PUBLIC_MAP_ENGINE,
  privacyPolicyUrl: cleanHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL) ?? DEFAULT_PRIVACY_POLICY_URL,
  // Needs Firebase and the backend's push; while off, or with no Firebase on the tablet, the app says plainly that alerts need the app to be open.
  pushEnabled: parseFlag(process.env.EXPO_PUBLIC_PUSH_ENABLED),
  // Live view, calls and group calls. Off unless a build turns it on: the production and live profiles do.
  liveEnabled: parseFlag(process.env.EXPO_PUBLIC_LIVE_ENABLED),
  // The backend has no push channel for the dashboard, so lists poll.
  pollIntervalMs: 10_000,
} as const
