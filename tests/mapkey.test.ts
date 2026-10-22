import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createRunner } from './harness'

const { t, report } = createRunner()
const KEY = 'AIza' + 'x'.repeat(35)

async function main() {
  await t('a Google key from the build settings goes into the Android build and tells the app a Google map is possible; with none, nothing is added', () => {
    const load = createRequire(`${process.cwd()}/`)
    type Out = { android?: { config?: { googleMaps?: { apiKey?: string }; other?: number } }; extra?: { googleMapsEnabled?: boolean } }
    const cfg = (config: object = {}) => (load('./app.config.js') as (a: { config: object }) => Out)({ config: { android: {}, ...config } })
    const saved = process.env.GOOGLE_MAPS_ANDROID_API_KEY, savedWarn = console.warn, warnings: string[] = []; console.warn = (m: string) => { warnings.push(String(m)) }
    try {
      delete process.env.GOOGLE_MAPS_ANDROID_API_KEY
      assert.equal(cfg().android?.config?.googleMaps, undefined, 'no key: nothing added'); assert.equal(cfg().extra?.googleMapsEnabled, undefined, 'and the app is told nothing')
      process.env.GOOGLE_MAPS_ANDROID_API_KEY = KEY; const on = cfg(); assert.equal(on.android?.config?.googleMaps?.apiKey, KEY); assert.equal(on.extra?.googleMapsEnabled, true)
      process.env.GOOGLE_MAPS_ANDROID_API_KEY = `  ${KEY}\n`; assert.equal(cfg().android?.config?.googleMaps?.apiKey, KEY, 'spaces and a newline around it are trimmed')
      assert.equal(cfg({ android: { config: { other: 7 } } }).android?.config?.other, 7, 'other Android config is kept'); assert.equal(warnings.length, 0, 'nothing wrong, nothing said')
      // the wrong things: ignored, so the tablet keeps the OpenStreetMap map, and named without giving the key away
      for (const wrong of ['"' + KEY + '"', 'AIza-too-short', 'not a key at all', KEY + 'extra', 'aiza' + 'x'.repeat(35), 'AIza' + 'x'.repeat(34)]) {
        warnings.length = 0; process.env.GOOGLE_MAPS_ANDROID_API_KEY = wrong; const off = cfg()
        assert.equal(off.android?.config?.googleMaps, undefined, `"${wrong.slice(0, 12)}..." is not a key: ignored`); assert.equal(off.extra?.googleMapsEnabled, undefined, 'so the app is not told a Google map is possible')
        assert.ok(warnings.length === 1 && /does not look like a Google API key/.test(warnings[0]), 'and one warning says why'); assert.ok(!warnings[0].includes(wrong) || wrong.length <= 4, 'the warning never prints the whole value')
      }
      process.env.GOOGLE_MAPS_ANDROID_API_KEY = '   '; warnings.length = 0; assert.equal(cfg().android?.config?.googleMaps, undefined, 'blank is the same as none'); assert.equal(warnings.length, 0)
    } finally { console.warn = savedWarn; if (saved === undefined) delete process.env.GOOGLE_MAPS_ANDROID_API_KEY; else process.env.GOOGLE_MAPS_ANDROID_API_KEY = saved }
  })
}
main().then(report)
