import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { env } from '@/config/env'
import { registerPush, unregisterPush } from '@/modules/push/api/push.api'
import type { PushAdapter } from '@/modules/push/lib/adapter'
import { IOS_SIREN_SOUND } from '@/modules/push/lib/channels'
import { isPushEnabled, registrationPlatform } from '@/modules/push/lib/enabled'
import { syncPush } from '@/modules/push/lib/sync'
import { chooseMapEngine } from '@/modules/map/lib/nativeMap'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
const appJson = JSON.parse(read('app.json')) as { expo?: Record<string, any> }
const expo = appJson.expo ?? (appJson as Record<string, any>)
const plugin = (name: string): Record<string, any> => ((expo.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, any>])[1]

// Reads the format of a WAV file from its header: how long it plays and how it is stored.
function wavInfo(file: string) {
  const b = readFileSync(resolve(process.cwd(), file))
  assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 12), 'WAVE')
  let at = 12; let rate = 0; let bytesPerSecond = 0; let format = 0; let dataBytes = 0
  while (at + 8 <= b.length) {
    const id = b.toString('ascii', at, at + 4); const size = b.readUInt32LE(at + 4)
    if (id === 'fmt ') { format = b.readUInt16LE(at + 8); rate = b.readUInt32LE(at + 12); bytesPerSecond = b.readUInt32LE(at + 16) }
    if (id === 'data') dataBytes = size
    at += 8 + size + (size % 2)
  }
  return { format, rate, seconds: dataBytes / bytesPerSecond }
}

const adapter = (over: Partial<PushAdapter> = {}): PushAdapter => ({
  isSupported: () => true, setup: async () => {}, permission: async () => 'granted', requestPermission: async () => 'granted',
  getToken: async () => 'ExponentPushToken[abcdefghijklmnop]', onTokenChange: () => () => {}, onReceive: () => () => {}, onTap: () => () => {},
  initialTap: () => null, dismiss: async () => {}, sendTest: async () => {}, openSettings: async () => {}, openBatterySettings: async () => {}, ...over,
})

async function main() {
  await t('an iPad gets Apple Maps, and only an explicit osm preference changes that', () => {
    assert.equal(chooseMapEngine({ platform: 'ios', hasKey: false }), 'apple', 'no Google key is needed')
    assert.equal(chooseMapEngine({ platform: 'ios', hasKey: true }), 'apple', 'a Google key does not matter on Apple devices')
    for (const back of ['osm', 'OSM', ' osm ', 'leaflet']) assert.equal(chooseMapEngine({ platform: 'ios', hasKey: false, preference: back }), 'leaflet', back)
    for (const other of [undefined, '', 'google', 'nonsense']) assert.equal(chooseMapEngine({ platform: 'ios', hasKey: false, preference: other }), 'apple', String(other))
  })
  await t('Android and the browser choose exactly as before', () => {
    assert.equal(chooseMapEngine({ platform: 'android', hasKey: true }), 'google')
    assert.equal(chooseMapEngine({ platform: 'android', hasKey: false }), 'leaflet')
    assert.equal(chooseMapEngine({ platform: 'android', hasKey: true, preference: 'osm' }), 'leaflet')
    assert.equal(chooseMapEngine({ platform: 'web', hasKey: true }), 'leaflet')
  })

  await t('iPad alerts have their own switch, off unless set, and the Android switch cannot turn them on', () => {
    assert.equal(env.pushIosEnabled, false, 'off by default')
    assert.equal(isPushEnabled('ios', { pushEnabled: true, pushIosEnabled: false }), false)
    assert.equal(isPushEnabled('ios', { pushEnabled: false, pushIosEnabled: true }), true)
    assert.equal(isPushEnabled('android', { pushEnabled: true, pushIosEnabled: false }), true, 'Android alerts are not held back by the iPad switch')
    assert.equal(isPushEnabled('android', { pushEnabled: false, pushIosEnabled: true }), false)
    assert.equal(isPushEnabled('web', { pushEnabled: true, pushIosEnabled: false }), true, 'the sample-data preview keeps using the general switch')
  })
  await t('an iPad registers as ios, and everything else as android', () => {
    assert.equal(registrationPlatform('ios'), 'ios')
    for (const os of ['android', 'web', 'windows', '']) assert.equal(registrationPlatform(os), 'android', os)
  })

  await t('registering from an iPad sends platform ios with its Expo token, and Android still sends android', async () => {
    const seen: Array<{ platform: string; token: string; installId: string }> = []
    const register = async (r: { installId: string; token: string; platform: 'android' | 'ios' }) => { seen.push(r) }
    const deps = { adapter: adapter(), register, installId: async () => 'install-abc12345', appVersion: '0.1.0', ask: false }
    assert.equal(await syncPush({ ...deps, platform: 'ios' }), 'on')
    assert.equal(await syncPush({ ...deps, platform: 'android' }), 'on')
    assert.deepEqual(seen.map((s) => s.platform), ['ios', 'android'])
    assert.ok(seen.every((s) => s.token === 'ExponentPushToken[abcdefghijklmnop]'))
  })
  await t('an iPad that was refused permission, or has no valid token, is not registered', async () => {
    let called = 0; const register = async () => { called += 1 }
    const base = { register, installId: async () => 'install-abc12345', appVersion: '0.1.0', platform: 'ios' as const, ask: true }
    assert.equal(await syncPush({ ...base, adapter: adapter({ permission: async () => 'undetermined', requestPermission: async () => 'denied' }) }), 'blocked')
    assert.equal(await syncPush({ ...base, ask: false, adapter: adapter({ permission: async () => 'undetermined' }) }), 'needs-permission', 'never asks unprompted')
    assert.equal(await syncPush({ ...base, adapter: adapter({ getToken: async () => 'not-a-token' }) }), 'unavailable')
    assert.equal(await syncPush({ ...base, adapter: adapter({ getToken: async () => { throw new Error('no APNs key yet') } }) }), 'unavailable', 'no Apple push key yet is a quiet state, not a crash')
    assert.equal(called, 0)
  })
  await t('a backend that refuses the iPad is reported as an error, not as success', async () => {
    const register = async () => { throw new Error('HTTP 400') }
    assert.equal(await syncPush({ adapter: adapter(), register, installId: async () => 'install-abc12345', appVersion: '0.1.0', platform: 'ios', ask: false }), 'error')
  })

  await t('against a pretend Cypher that accepts ios, the iPad registration goes through as the contract in the APIs document says', async () => {
    let body: Record<string, unknown> | null = null
    http.calls.length = 0
    http.routes = {
      'PUT /push/registrations/install-abc12345': (call) => {
        body = call.data as Record<string, unknown>
        const okPlatform = body.platform === 'android' || body.platform === 'ios'
        const okToken = /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(String(body.token))
        return okPlatform && okToken ? { status: 204, data: undefined } : { status: 400, data: { error: okToken ? 'invalid_platform' : 'invalid_token' } }
      },
      'DELETE /push/registrations/install-abc12345': () => ({ status: 404, data: undefined }),
    }
    await registerPush({ installId: 'install-abc12345', token: 'ExponentPushToken[abcdefghijklmnop]', platform: 'ios', appVersion: '0.1.0' })
    assert.deepEqual(body, { token: 'ExponentPushToken[abcdefghijklmnop]', platform: 'ios', appVersion: '0.1.0' })
    assert.equal(String(http.calls[0].method).toLowerCase(), 'put'); assert.match(String(http.calls[0].url), /\/push\/registrations\/install-abc12345$/)
    await unregisterPush('install-abc12345')
  })
  await t('against a pretend Cypher that has not been updated yet, the refusal is raised, so the switch can stay off until it is', async () => {
    http.routes = { 'PUT /push/registrations/install-abc12345': () => ({ status: 400, data: { error: 'invalid_platform' } }) }
    await assert.rejects(registerPush({ installId: 'install-abc12345', token: 'ExponentPushToken[abcdefghijklmnop]', platform: 'ios', appVersion: '0.1.0' }))
  })

  await t('the app is an iPad-only app, with the settings Apple needs', () => {
    assert.equal(expo.ios.supportsTablet, true); assert.equal(expo.ios.isTabletOnly, true)
    assert.equal(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption, false, 'export compliance answered once, in the app')
    assert.equal(expo.ios.bundleIdentifier, 'com.e5energy.smarthelmet')
    assert.equal(expo.ios.entitlements['com.apple.developer.usernotifications.time-sensitive'], true)
  })
  await t('the microphone and camera explanations say what they are really used for, and the two microphone plugins agree', () => {
    const audio = plugin('expo-audio').microphonePermission as string; const webrtc = plugin('@config-plugins/react-native-webrtc')
    assert.equal(webrtc.microphonePermission, audio, 'both plugins write the same Info.plist key, so they must say the same thing')
    for (const use of [/calls/i, /voice messages/i, /fence warning clips/i]) assert.match(audio, use)
    assert.match(webrtc.cameraPermission, /video calls/i)
    for (const text of [audio, webrtc.cameraPermission as string]) assert.ok(text.length > 40 && text.endsWith('.'), 'a full sentence, not a bare placeholder')
  })
  await t('the iPad siren is a separate file, between 10 and 30 seconds, in a format Apple plays, and the Android siren is untouched', () => {
    const sounds = plugin('expo-notifications').sounds as string[]
    assert.ok(sounds.includes('./assets/sounds/sos-long.wav') && sounds.includes('./assets/sounds/sos.wav'))
    assert.equal(IOS_SIREN_SOUND, 'sos-long.wav')
    const long = wavInfo('assets/sounds/sos-long.wav'); const short = wavInfo('assets/sounds/sos.wav')
    assert.equal(long.format, 1, 'linear PCM'); assert.ok(long.seconds >= 10 && long.seconds < 30, `plays for ${long.seconds} seconds`)
    assert.ok(short.seconds < 3, 'the Android siren is still the short one')
  })
  await t('the app stays iPad only unless a build explicitly turns that off, and a typo can never turn it off', () => {
    const wrap = createRequire(resolve(process.cwd(), 'package.json'))(resolve(process.cwd(), 'app.config.js')) as (o: { config: Record<string, any> }) => Record<string, any>
    const saved = process.env.E5_IOS_TABLET_ONLY
    const tabletOnly = (value: string | undefined) => {
      if (value === undefined) delete process.env.E5_IOS_TABLET_ONLY; else process.env.E5_IOS_TABLET_ONLY = value
      const warn = console.warn; console.warn = () => {}
      try { return wrap({ config: structuredClone(expo) }).ios.isTabletOnly } finally { console.warn = warn }
    }
    try {
      assert.equal(tabletOnly(undefined), true, 'unset: iPad only')
      for (const off of ['false', 'False', 'FALSE', ' false ', '0', 'no', 'off']) assert.equal(tabletOnly(off), false, `${JSON.stringify(off)} lets an iPhone install it`)
      for (const keep of ['', 'true', '1', 'yes', 'on', 'flase', 'fasle', 'nope']) assert.equal(tabletOnly(keep), true, `${JSON.stringify(keep)} keeps it iPad only`)
    } finally {
      if (saved === undefined) delete process.env.E5_IOS_TABLET_ONLY; else process.env.E5_IOS_TABLET_ONLY = saved
    }
  })
  await t('only the iPhone test profile turns the iPad-only rule off, and the store profile cannot', () => {
    const eas = JSON.parse(read('eas.json')).build as Record<string, { extends?: string; env?: Record<string, string> }>
    const effective = (name: string): Record<string, string> => ({ ...(eas[name].extends ? effective(eas[name].extends as string) : {}), ...(eas[name].env ?? {}) })
    const off = Object.keys(eas).filter((name) => effective(name).E5_IOS_TABLET_ONLY !== undefined)
    assert.deepEqual(off, ['ios-testflight-iphone'], 'no other profile sets it')
    assert.equal(effective('ios-testflight-iphone').E5_IOS_TABLET_ONLY, 'false')
    assert.equal(eas['ios-testflight-iphone'].extends, 'production', 'it is the production build plus that one switch')
    assert.equal(effective('production').E5_IOS_TABLET_ONLY, undefined)
    assert.equal(expo.ios.isTabletOnly, true, 'and app.json itself says iPad only')
  })
  await t('the settings template mentions the iPad switch', () => {
    assert.match(read('.env.example'), /EXPO_PUBLIC_PUSH_IOS_ENABLED/)
  })
}
main().then(report)
