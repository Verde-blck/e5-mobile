// Wraps app.json. The one thing it adds: Firebase's client config for push alerts, which comes
// from E5's own Firebase project (docs/PUSH_SETUP.md). The app builds and runs without it; alerts
// for a locked tablet simply stay unavailable until the file is there.
const fs = require('fs')
const path = require('path')

module.exports = ({ config }) => {
  // On EAS the file can be a "file" environment variable (its value is a path); locally, a file at the
  // project root named google-services.json.
  const local = path.join(__dirname, 'google-services.json')
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined)

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  }
}
