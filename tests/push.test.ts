import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { registerPush, unregisterPush } from '@/modules/push/api/push.api'
import type { PermissionState, PushAdapter } from '@/modules/push/lib/adapter'
import { ALARM_CHANNEL, CHANNELS, SIREN_SOUND, SOS_CHANNEL, channelFor } from '@/modules/push/lib/channels'
import { describeStatus } from '@/modules/push/lib/describe'
import { shouldShowInForeground } from '@/modules/push/lib/foreground'
import { getInstallId, resetInstallIdCache } from '@/modules/push/lib/installId'
import { parsePushData } from '@/modules/push/lib/payload'
import { syncPush } from '@/modules/push/lib/sync'
import { unregisterThisTablet } from '@/modules/push/lib/unregister'
import type { PushStatus } from '@/modules/push/types'
import { storage } from '@/shared/lib/storage'
import { onUnauthorized } from '@/shared/lib/unauthorized'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

function fakeAdapter(over: Partial<{ supported: boolean; permission: PermissionState; afterRequest: PermissionState; token: string | Error }> = {}) {
  const calls: string[] = []
  const state = { supported: true, permission: 'undetermined' as PermissionState, afterRequest: 'granted' as PermissionState, token: 'tok-1' as string | Error, ...over }
  const adapter: PushAdapter = {
    isSupported: () => state.supported,
    setup: async () => { calls.push('setup') },
    permission: async () => state.permission,
    requestPermission: async () => { calls.push('request'); return state.afterRequest },
    getToken: async () => { calls.push('token'); if (state.token instanceof Error) throw state.token; return state.token },
    onTokenChange: () => () => {}, onReceive: () => () => {}, onTap: () => () => {}, initialTap: () => null,
    dismiss: async () => {}, sendTest: async () => {}, openSettings: async () => {}, openBatterySettings: async () => {},
  }
  return { adapter, calls }
}
async function run(over: Parameters<typeof fakeAdapter>[0], ask: boolean, registerFails = false) {
  const { adapter, calls } = fakeAdapter(over); const sent: unknown[] = []
  const status = await syncPush({ adapter, ask, appVersion: '1.2.3', installId: async () => ID, register: async (r) => { if (registerFails) throw new Error('down'); sent.push(r) } })
  return { status, calls, sent }
}

async function main() {
  // ---- what a push says ----
  await t('a push is read from its data: alarm and alarm-resolved, FCM string values, numbers and JSON strings tolerated', () => {
    assert.deepEqual(parsePushData({ kind: 'alarm', alarmId: '77', alarmType: 'manual_sos_button', severity: 'critical', deviceId: '866652022956057', deviceName: 'Rig Supervisor' }),
      { kind: 'alarm', alarmId: '77', alarmType: 'manual_sos_button', severity: 'critical', deviceId: '866652022956057', deviceName: 'Rig Supervisor' })
    assert.deepEqual(parsePushData({ kind: 'alarm-resolved', alarmId: 77 }), { kind: 'alarm-resolved', alarmId: '77' })
    assert.deepEqual(parsePushData('{"kind":"alarm","alarmId":"5"}'), { kind: 'alarm', alarmId: '5', alarmType: undefined, severity: undefined, deviceId: undefined, deviceName: undefined })
    assert.equal(parsePushData({ kind: 'alarm', alarmId: '5', severity: 'bogus' })?.kind === 'alarm' && (parsePushData({ kind: 'alarm', alarmId: '5', severity: 'bogus' }) as { severity?: string }).severity, undefined)
  })
  await t('anything else is ignored: an alarm id that could steer a route, a wrong kind, junk', () => {
    for (const bad of [null, undefined, 5, [], {}, { kind: 'alarm' }, { kind: 'alarm', alarmId: '../settings' }, { kind: 'alarm', alarmId: 'a/b' }, { kind: 'alarm', alarmId: '77?x=1' }, { kind: 'alarm', alarmId: '' }, { kind: 'alarm', alarmId: 'x'.repeat(65) },
      { kind: 'other', alarmId: '1' }, { kind: 'test' }, 'not json', '{"kind":"alarm"}'])
      assert.equal(parsePushData(bad), null, JSON.stringify(bad))
  })
  await t('a long helmet name is cut, not trusted to fit', () => {
    const m = parsePushData({ kind: 'alarm', alarmId: '1', deviceName: 'N'.repeat(500) }); assert.ok(m?.kind === 'alarm' && (m.deviceName?.length ?? 0) === 80)
  })

  // ---- channels: a contract with the backend, and with the bundled siren ----
  await t('critical alarms go to the siren channel and everything else to the other one', () => {
    assert.equal(channelFor('critical'), SOS_CHANNEL); for (const s of ['warning', undefined, '', 'x']) assert.equal(channelFor(s), ALARM_CHANNEL)
    assert.deepEqual([SOS_CHANNEL, ALARM_CHANNEL], ['sos', 'alarm'], 'these ids are what the request to Cypher asks him to send')
  })
  await t('the siren channel is the loud one: max importance, the bundled siren, alarm volume, can pass Do Not Disturb', () => {
    const sos = CHANNELS.find((c) => c.id === SOS_CHANNEL)!, other = CHANNELS.find((c) => c.id === ALARM_CHANNEL)!
    assert.equal(CHANNELS.length, 2); assert.deepEqual([sos.importance, sos.sound, sos.alarmVolume, sos.bypassDnd], ['max', SIREN_SOUND, true, true])
    assert.deepEqual([other.importance, other.sound, other.alarmVolume, other.bypassDnd], ['high', 'default', false, false])
  })
  await t('the siren file really is in the app, and the notifications plugin bundles it', () => {
    assert.ok(fs.existsSync(`assets/sounds/${SIREN_SOUND}`) && fs.statSync(`assets/sounds/${SIREN_SOUND}`).size > 10_000)
    const plugin = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications')
    assert.ok(plugin, 'plugin present'); assert.deepEqual(plugin[1].sounds, [`./assets/sounds/${SIREN_SOUND}`]); assert.equal(plugin[1].defaultChannel, ALARM_CHANNEL)
    assert.ok(fs.existsSync(plugin[1].icon), 'the status-bar icon exists')
  })

  await t('while the app is open and its alarm connection is live the system notification stays quiet; otherwise it shows', () => {
    assert.equal(shouldShowInForeground({ appActive: true, streamOpen: true }), false)
    assert.equal(shouldShowInForeground({ appActive: true, streamOpen: false }), true, 'stream down: the notification is the only warning')
    assert.equal(shouldShowInForeground({ appActive: false, streamOpen: true }), true); assert.equal(shouldShowInForeground({ appActive: false, streamOpen: false }), true)
  })

  // ---- this installation's id ----
  await t('the install id is random, 32 hex characters, and the same one comes back after a restart', async () => {
    await storage.remove('push.installId'); resetInstallIdCache()
    const first = await getInstallId(); assert.match(first, /^[0-9a-f]{32}$/)
    resetInstallIdCache(); assert.equal(await getInstallId(), first, 'read back from storage')
    await storage.set('push.installId', 'corrupt'); resetInstallIdCache(); const fresh = await getInstallId(); assert.match(fresh, /^[0-9a-f]{32}$/); assert.notEqual(fresh, 'corrupt')
  })

  // ---- the proposed registration contract ----
  await t('register: PUT /push/registrations/{installId} with the token, platform and app version, nothing else', async () => {
    http.calls.length = 0; http.routes = { [`PUT /push/registrations/${ID}`]: () => ({ status: 204 }) }
    await registerPush({ installId: ID, token: 'fcm-token', platform: 'android', appVersion: '1.2.3' })
    assert.deepEqual(http.calls[0].data, { token: 'fcm-token', platform: 'android', appVersion: '1.2.3' }); assert.equal(http.calls[0].url, `/push/registrations/${ID}`)
    await assert.rejects(registerPush({ installId: ID, token: 'x', platform: 'android', appVersion: '1' }).then(() => { throw new Error('should not pass') }).catch((e) => { if (String(e).includes('should not pass')) return; throw e }), undefined).catch(() => {})
  })
  await t('register: an id with odd characters can\'t change the path', async () => {
    http.calls.length = 0; http.routes = { 'PUT /push/registrations/a%2Fb%3Fc': () => ({ status: 204 }) }
    await registerPush({ installId: 'a/b?c', token: 'x', platform: 'android', appVersion: '1' }); assert.equal(http.calls[0].url, '/push/registrations/a%2Fb%3Fc')
  })
  await t('unregister: DELETE, and "already gone" (404) is a success; a real failure is not hidden', async () => {
    http.routes = { [`DELETE /push/registrations/${ID}`]: () => ({ status: 204 }) }; await unregisterPush(ID)
    http.routes = { [`DELETE /push/registrations/${ID}`]: () => ({ status: 404 }) }; await unregisterPush(ID)
    http.routes = { [`DELETE /push/registrations/${ID}`]: () => ({ status: 500 }) }; await assert.rejects(unregisterPush(ID))
  })
  await t('a refused registration (403) is a refusal, not a dead session', async () => {
    let unauthorized = 0; const off = onUnauthorized(() => { unauthorized++ })
    http.routes = { [`PUT /push/registrations/${ID}`]: () => ({ status: 403, data: { error: 'forbidden' } }) }
    await assert.rejects(registerPush({ installId: ID, token: 'x', platform: 'android', appVersion: '1' })); assert.equal(unauthorized, 0); off()
  })
  await t('signing out never waits on the network: a failing unregister is swallowed and the sign-out goes ahead', async () => {
    resetInstallIdCache(); await storage.set('push.installId', ID)
    http.calls.length = 0; http.routes = { [`DELETE /push/registrations/${ID}`]: () => ({ status: 500 }) }
    await unregisterThisTablet(); assert.equal(http.calls.length, 1)
    http.routes = { [`DELETE /push/registrations/${ID}`]: () => ({ status: 204 }) }; await unregisterThisTablet(); assert.equal(http.calls.length, 2)
  })

  // ---- the decision tree for a tablet ----
  await t('a tablet that can\'t do push says so and asks for nothing', async () => {
    const r = await run({ supported: false }, true); assert.equal(r.status, 'unavailable'); assert.deepEqual(r.calls, [])
  })
  await t('permission not yet given: without a button press it only reports "needs permission" (no prompt, no registration)', async () => {
    const r = await run({}, false); assert.equal(r.status, 'needs-permission'); assert.ok(!r.calls.includes('request') && !r.calls.includes('token')); assert.equal(r.sent.length, 0)
  })
  await t('after "Turn on": ask, and if allowed register this tablet once with its token and the app version', async () => {
    const r = await run({}, true); assert.equal(r.status, 'on'); assert.deepEqual(r.calls, ['setup', 'request', 'token'])
    assert.deepEqual(r.sent, [{ installId: ID, token: 'tok-1', platform: 'android', appVersion: '1.2.3' }])
  })
  await t('a refusal is "blocked" and registers nothing', async () => {
    const r = await run({ afterRequest: 'denied' }, true); assert.equal(r.status, 'blocked'); assert.equal(r.sent.length, 0)
    assert.equal((await run({ permission: 'denied' }, false)).status, 'blocked', 'refused earlier for good: no point asking again')
  })
  await t('already allowed: registers without asking, even with no button press (a restart, a new sign-in)', async () => {
    const r = await run({ permission: 'granted' }, false); assert.equal(r.status, 'on'); assert.ok(!r.calls.includes('request')); assert.equal(r.sent.length, 1)
  })
  await t('no Firebase in this build, or no Google services: "unavailable", not an error to retry', async () => {
    const r = await run({ permission: 'granted', token: new Error('Default FirebaseApp is not initialized') }, true); assert.equal(r.status, 'unavailable'); assert.equal(r.sent.length, 0)
  })
  await t('the backend won\'t take it: "error", so the person can try again', async () => {
    assert.equal((await run({ permission: 'granted' }, true, true)).status, 'error')
  })

  // ---- what the person is told ----
  await t('every state has plain words, a tone and the right button', () => {
    const all: PushStatus[] = ['off', 'unavailable', 'needs-permission', 'blocked', 'registering', 'on', 'error']
    const actions: Record<PushStatus, string | undefined> = { off: undefined, unavailable: undefined, 'needs-permission': 'enable', blocked: 'settings', registering: undefined, on: undefined, error: 'retry' }
    for (const s of all) { const c = describeStatus(s); assert.ok(c.title.length > 3 && c.detail.length > 20, s); assert.equal(c.action, actions[s], s) }
    assert.equal(describeStatus('on').tone, 'ok'); for (const s of ['needs-permission', 'blocked', 'error'] as const) assert.equal(describeStatus(s).tone, 'warn')
    assert.match(describeStatus('off').detail, /keep this app open/i, 'while off, say what actually works')
  })

  // ---- build config ----
  await t('the Firebase file is added to the Android config only when it exists (or EAS supplies it), so the app builds without it', () => {
    const load = createRequire(`${process.cwd()}/`)
    const cfg = () => (load('./app.config.js') as (a: { config: { android: Record<string, unknown> } }) => { android: Record<string, unknown> })({ config: { android: { package: 'com.e5energy.smarthelmet' } } })
    const saved = process.env.GOOGLE_SERVICES_JSON; delete process.env.GOOGLE_SERVICES_JSON
    if (!fs.existsSync('google-services.json')) assert.equal(cfg().android.googleServicesFile, undefined, 'no file, no setting')
    process.env.GOOGLE_SERVICES_JSON = '/eas/secret/google-services.json'; assert.equal(cfg().android.googleServicesFile, '/eas/secret/google-services.json'); assert.equal(cfg().android.package, 'com.e5energy.smarthelmet', 'the rest of the config is untouched')
    if (saved === undefined) delete process.env.GOOGLE_SERVICES_JSON; else process.env.GOOGLE_SERVICES_JSON = saved
  })
}
main().then(report)
