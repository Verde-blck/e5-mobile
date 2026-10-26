// Wraps app.json with the few values that belong to this project's accounts rather than to the code.
const fs = require('fs')
const path = require('path')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NIL_UUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/
const EXAMPLE_OWNER = 'your-expo-username-or-organisation'

const GOOGLE_KEY = /^AIza[0-9A-Za-z_-]{35}$/

const warned = new Set()
function warn(message) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[e5] ${message}`)
}

// Only a real UUID is passed on: anything else would reach EAS as it is, and EAS answers "Invalid UUID appId",
// which says nothing about where the value came from. A wrong one is ignored here and named in a warning.
function projectIdFrom(value, where) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const id = value.trim().replace(/^(?:project\s*id|id)\s*[:=]\s*/i, '').replace(/^["']|["']$/g, '').trim()
  if (NIL_UUID.test(id)) return undefined
  if (!UUID.test(id)) {
    warn(`${where}: "${id}" is not an Expo project ID, so it was ignored. It looks like 12345678-1234-4234-8234-123456789abc: copy it from the project's page on expo.dev, or run "npx eas-cli init".`)
    return undefined
  }
  return id
}

// A key that isn't shaped like a Google key (pasted with quotes or spaces, say) is ignored so the
// tablet keeps the OpenStreetMap map, and is named in a warning that never prints the key.
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

function ownerFrom(value) {
  if (typeof value !== 'string') return undefined
  const owner = value.trim()
  return owner && owner !== EXAMPLE_OWNER && !/\s/.test(owner) ? owner : undefined
}

// Kept out of app.json on purpose: unpacking a zip replaces app.json, which silently wiped these lines
// before. No zip contains e5.local.json. Commit it, since EAS builds only see committed files.
function readLocal() {
  let text
  try {
    text = fs.readFileSync(path.join(__dirname, 'e5.local.json'), 'utf8')
  } catch {
    return {}
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (error) {
    // A file that can't be read is ignored so it can never break a build, but not silently: a stray
    // comma after the last line would otherwise leave the project unlinked with no hint why.
    warn(`e5.local.json could not be read as JSON (${error.message}), so it was ignored. A common cause is a comma after the last line. It should look like: { "projectId": "12345678-1234-4234-8234-123456789abc" }`)
    return {}
  }
  return { projectId: projectIdFrom(raw?.projectId, 'e5.local.json'), owner: ownerFrom(raw?.owner) }
}

module.exports = ({ config }) => {
  const local = readLocal()

  const firebase = path.join(__dirname, 'google-services.json')
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(firebase) ? './google-services.json' : undefined)

  const projectId =
    projectIdFrom(config.extra?.eas?.projectId, 'app.json (extra.eas.projectId)') ?? local.projectId ?? projectIdFrom(process.env.EAS_PROJECT_ID, 'the EAS_PROJECT_ID environment variable')
  const owner = ownerFrom(config.owner) ?? local.owner
  const mapsKey = googleMapsKey()

  // The project ID in the result is the one chosen above, or none:
  // a bad one in app.json must not be left in to reach EAS.
  const { projectId: _dropped, ...otherEas } = config.extra?.eas ?? {}
  const eas = projectId ? { ...otherEas, projectId } : otherEas
  // `googleMapsEnabled` is how the app knows, while it runs, that
  // this build has a Google key and so can show the Google map.
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
