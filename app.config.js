// Wraps app.json with the few values that belong to THIS project's accounts rather than to the code.
// The app builds and runs without any of them; they only switch on push alerts and EAS builds.
const fs = require('fs')
const path = require('path')

/** An Expo project ID is a UUID: 8-4-4-4-12 hex digits, like 12345678-1234-4234-8234-123456789abc. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NIL_UUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/
const EXAMPLE_OWNER = 'your-expo-username-or-organisation'

/** A Google API key: "AIza" and 35 more letters, digits, dashes or underscores. */
const GOOGLE_KEY = /^AIza[0-9A-Za-z_-]{35}$/

const warned = new Set()
function warn(message) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[e5] ${message}`)
}

/**
 * A project ID, or undefined. Only a real UUID is passed on: anything else (the project's name, an account name, text left over
 * from the example file) would reach EAS as it is, and EAS answers "Invalid UUID appId", which says nothing about where it came from.
 * So a wrong value is ignored here and named in a warning instead.
 */
function projectIdFrom(value, where) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  // expo.dev shows the ID with a label ("ID: 12345678-..."), which is easy to copy along with the code: the label and any quotes or
  // spaces round the code are not part of it.
  const id = value.trim().replace(/^(?:project\s*id|id)\s*[:=]\s*/i, '').replace(/^["']|["']$/g, '').trim()
  if (NIL_UUID.test(id)) return undefined // the placeholder in e5.local.example.json
  if (!UUID.test(id)) {
    warn(`${where}: "${id}" is not an Expo project ID, so it was ignored. It looks like 12345678-1234-4234-8234-123456789abc: copy it from the project's page on expo.dev, or run "npx eas-cli init".`)
    return undefined
  }
  return id
}

/**
 * The Google Maps key for the Android map, from the GOOGLE_MAPS_ANDROID_API_KEY build setting, or undefined. The key is never
 * written into the repository: it is set on EAS (docs/GOOGLE_MAPS.md). One that isn't shaped like a Google key (text pasted with
 * quotes or spaces, the wrong thing altogether) is ignored, so the tablet keeps the OpenStreetMap map, and is named in a warning
 * that gives its length and first four characters only, never the key.
 */
function googleMapsKey() {
  const raw = process.env.GOOGLE_MAPS_ANDROID_API_KEY
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const key = raw.trim()
  if (!GOOGLE_KEY.test(key)) {
    warn(`GOOGLE_MAPS_ANDROID_API_KEY does not look like a Google API key (they start with "AIza" and are 39 characters; this is ${key.length} characters and starts with "${key.slice(0, 4)}"), so the Google map is switched off and the OpenStreetMap map is used. Check it for quotes, spaces or a different value.`)
    return undefined
  }
  return key
}

/** An owner (an Expo username or organisation), or undefined. The example's placeholder and anything with spaces is not one. */
function ownerFrom(value) {
  if (typeof value !== 'string') return undefined
  const owner = value.trim()
  return owner && owner !== EXAMPLE_OWNER && !/\s/.test(owner) ? owner : undefined
}

/**
 * e5.local.json (project root): { "projectId": "...", "owner": "..." }, the Expo project this app belongs to.
 * It is kept out of app.json on purpose. app.json is replaced whenever a new zip is unpacked, which silently
 * wiped these lines before; no zip ever contains e5.local.json, so unpacking can't touch it. Commit it:
 * EAS builds only see what is committed. A missing, unreadable or still-placeholder file is simply ignored.
 */
function readLocal() {
  let text
  try {
    text = fs.readFileSync(path.join(__dirname, 'e5.local.json'), 'utf8')
  } catch {
    return {} // no file: that is fine, the link can come from app.json or the environment
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (error) {
    // A file that can't be read is ignored (it must never break a build), but not silently: a stray comma after the last line, or a
    // missing quote, would otherwise leave the project unlinked with no hint why.
    warn(`e5.local.json could not be read as JSON (${error.message}), so it was ignored. A common cause is a comma after the last line. It should look like: { "projectId": "12345678-1234-4234-8234-123456789abc" }`)
    return {}
  }
  return { projectId: projectIdFrom(raw?.projectId, 'e5.local.json'), owner: ownerFrom(raw?.owner) }
}

module.exports = ({ config }) => {
  const local = readLocal()

  // Firebase's client config for push alerts, from E5's own Firebase project (docs/PUSH_SETUP.md). On EAS the
  // file can be a "file" environment variable (its value is a path); locally, google-services.json at the root.
  const firebase = path.join(__dirname, 'google-services.json')
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(firebase) ? './google-services.json' : undefined)

  // Expo issues push tokens per EAS project, and `eas build` needs the link. Where it comes from, in order:
  // app.json (if `eas init` wrote it there), then e5.local.json, then the EAS_PROJECT_ID environment variable.
  const projectId =
    projectIdFrom(config.extra?.eas?.projectId, 'app.json (extra.eas.projectId)') ?? local.projectId ?? projectIdFrom(process.env.EAS_PROJECT_ID, 'the EAS_PROJECT_ID environment variable')
  const owner = ownerFrom(config.owner) ?? local.owner
  const mapsKey = googleMapsKey()

  // The project ID in the result is the one chosen above, or none: a bad one in app.json must not be left in to reach EAS.
  const { projectId: _dropped, ...otherEas } = config.extra?.eas ?? {}
  const eas = projectId ? { ...otherEas, projectId } : otherEas
  // `googleMapsEnabled` is how the app knows, while it runs, that this build has a Google key and so can show the Google map.
  const extra = config.extra || projectId || mapsKey ? { ...config.extra, eas, ...(mapsKey ? { googleMapsEnabled: true } : {}) } : undefined

  return {
    ...config,
    ...(owner ? { owner } : {}),
    ...(extra ? { extra } : {}),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
  }
}
