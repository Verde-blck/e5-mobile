// Wraps app.json with the few values that belong to THIS project's accounts rather than to the code.
// The app builds and runs without any of them; they only switch on push alerts and EAS builds.
const fs = require('fs')
const path = require('path')

/**
 * e5.local.json (project root): { "projectId": "...", "owner": "..." }, the Expo project this app belongs to.
 * It is kept out of app.json on purpose. app.json is replaced whenever a new zip is unpacked, which silently
 * wiped these lines before; no zip ever contains e5.local.json, so unpacking can't touch it. Commit it:
 * EAS builds only see what is committed. A missing, unreadable or still-placeholder file is simply ignored.
 */
function readLocal() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'e5.local.json'), 'utf8'))
    const real = (value) => (typeof value === 'string' && value.trim() && !/^0{8}-0{4}-/.test(value.trim()) ? value.trim() : undefined)
    return { projectId: real(raw.projectId), owner: real(raw.owner) }
  } catch {
    return {}
  }
}

module.exports = ({ config }) => {
  const local = readLocal()

  // Firebase's client config for push alerts, from E5's own Firebase project (docs/PUSH_SETUP.md). On EAS the
  // file can be a "file" environment variable (its value is a path); locally, google-services.json at the root.
  const firebase = path.join(__dirname, 'google-services.json')
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(firebase) ? './google-services.json' : undefined)

  // Expo issues push tokens per EAS project, and `eas build` needs the link. Where it comes from, in order:
  // app.json (if `eas init` wrote it there), then e5.local.json, then the EAS_PROJECT_ID environment variable.
  const projectId = config.extra?.eas?.projectId ?? local.projectId ?? process.env.EAS_PROJECT_ID
  const owner = config.owner ?? local.owner

  return {
    ...config,
    ...(owner ? { owner } : {}),
    ...(projectId ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } } : {}),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  }
}
