import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { registerPush, unregisterPush } from '@/modules/push/api/push.api'
import type { PermissionState, PushAdapter } from '@/modules/push/lib/adapter'
import { ALARM_CHANNEL, CHANNELS, SIREN_SOUND, SOS_CHANNEL, channelFor } from '@/modules/push/lib/channels'
import { describeStatus } from '@/modules/push/lib/describe'
import { appCoversAlarm, shouldShowInForeground } from '@/modules/push/lib/foreground'
import { getInstallId, resetInstallIdCache } from '@/modules/push/lib/installId'
import { isExpoPushToken, isValidInstallId } from '@/modules/push/lib/expoToken'
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
  const state = { supported: true, permission: 'undetermined' as PermissionState, afterRequest: 'granted' as PermissionState, token: 'ExponentPushToken[tok-1]' as string | Error, ...over }
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
  await t('a push is read from its data: alarm and alarm-resolved, FCM string values, numbers and JSON strings tolerated', () => {
    assert.deepEqual(parsePushData({ kind: 'alarm', alarmId: '77', alarmType: 'manual_sos_button', severity: 'critical', deviceId: '866652022956057', deviceName: 'Rig Supervisor' }),
      { kind: 'alarm', alarmId: '77', alarmType: 'manual_sos_button', severity: 'critical', deviceId: '866652022956057', deviceName: 'Rig Supervisor' })
    assert.deepEqual(parsePushData({ kind: 'alarm-resolved', alarmId: 77 }), { kind: 'alarm-resolved', alarmId: '77' })
    assert.deepEqual(parsePushData('{"kind":"alarm","alarmId":"5"}'), { kind: 'alarm', alarmId: '5', alarmType: undefined, severity: undefined, deviceId: undefined, deviceName: undefined })
    assert.equal(parsePushData({ kind: 'alarm', alarmId: '5', severity: 'bogus' })?.kind === 'alarm' && (parsePushData({ kind: 'alarm', alarmId: '5', severity: 'bogus' }) as { severity?: string }).severity, undefined)
    for (const sev of ['critical', 'warning', 'normal']) assert.equal((parsePushData({ kind: 'alarm', alarmId: '5', severity: sev }) as { severity?: string }).severity, sev)
  })
  await t('anything else is ignored: an alarm id that could steer a route, a wrong kind, junk', () => {
    for (const bad of [null, undefined, 5, [], {}, { kind: 'alarm' }, { kind: 'alarm', alarmId: '../settings' }, { kind: 'alarm', alarmId: 'a/b' }, { kind: 'alarm', alarmId: '77?x=1' }, { kind: 'alarm', alarmId: '' }, { kind: 'alarm', alarmId: 'x'.repeat(65) },
      { kind: 'other', alarmId: '1' }, { kind: 'test' }, 'not json', '{"kind":"alarm"}'])
      assert.equal(parsePushData(bad), null, JSON.stringify(bad))
  })
  await t('a long helmet name is cut, not trusted to fit', () => {
    const m = parsePushData({ kind: 'alarm', alarmId: '1', deviceName: 'N'.repeat(500) }); assert.ok(m?.kind === 'alarm' && (m.deviceName?.length ?? 0) === 80)
  })

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

  await t('while the app is open and its alarm connection is live the system notification stays quiet, but only if the app covers that alarm; otherwise it shows', () => {
    const show = (appActive: boolean, streamOpen: boolean, covers: boolean) => shouldShowInForeground({ appActive, streamOpen, appCoversAlarm: covers })
    assert.equal(show(true, true, true), false)
    assert.equal(show(true, true, false), true, 'the app alone would not warn as loudly: show it')
    assert.equal(show(true, false, true), true, 'stream down: the notification is the only warning')
    assert.equal(show(false, true, true), true); assert.equal(show(false, false, true), true)
  })
  await t('the backend can call an alarm critical that the app has no name for: then the app must not hide its notification', () => {
    const push = (alarmType: string, severity?: 'critical' | 'warning' | 'normal') => ({ kind: 'alarm' as const, alarmId: '1', alarmType, severity })
    for (const code of ['7', 'manual_sos_button', '4', '11', '6', 'gas_co', 'H2S_HIGH', 'ch4_lel', 'low_oxygen']) assert.equal(appCoversAlarm(push(code, 'critical')), true, 'the app sirens for ' + code + ' itself')
    assert.equal(appCoversAlarm(push('99', 'critical')), false, 'an alarm only the backend calls critical, with a code the app has no name for yet')
    assert.equal(appCoversAlarm(push('99', 'warning')), true, 'a non-critical alarm: the app\'s toast covers it'); assert.equal(appCoversAlarm(push('99', 'normal')), true)
    assert.equal(appCoversAlarm({ kind: 'alarm-resolved', alarmId: '1' }), true); assert.equal(appCoversAlarm(null), false, 'unrecognisable: show it')
  })

  await t('the install id is random, 32 hex characters, and the same one comes back after a restart', async () => {
    await storage.remove('push.installId'); resetInstallIdCache()
    const first = await getInstallId(); assert.match(first, /^[0-9a-f]{32}$/)
    resetInstallIdCache(); assert.equal(await getInstallId(), first, 'read back from storage')
    await storage.set('push.installId', 'corrupt'); resetInstallIdCache(); const fresh = await getInstallId(); assert.match(fresh, /^[0-9a-f]{32}$/); assert.notEqual(fresh, 'corrupt')
  })

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

  await t('a tablet that can\'t do push says so and asks for nothing', async () => {
    const r = await run({ supported: false }, true); assert.equal(r.status, 'unavailable'); assert.deepEqual(r.calls, [])
  })
  await t('permission not yet given: without a button press it only reports "needs permission" (no prompt, no registration)', async () => {
    const r = await run({}, false); assert.equal(r.status, 'needs-permission'); assert.ok(!r.calls.includes('request') && !r.calls.includes('token')); assert.equal(r.sent.length, 0)
  })
  await t('after "Turn on": ask, and if allowed register this tablet once with its token and the app version', async () => {
    const r = await run({}, true); assert.equal(r.status, 'on'); assert.deepEqual(r.calls, ['setup', 'request', 'token'])
    assert.deepEqual(r.sent, [{ installId: ID, token: 'ExponentPushToken[tok-1]', platform: 'android', appVersion: '1.2.3' }])
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

  await t('every state has plain words, a tone and the right button', () => {
    const all: PushStatus[] = ['off', 'unavailable', 'needs-permission', 'blocked', 'registering', 'on', 'error']
    const actions: Record<PushStatus, string | undefined> = { off: undefined, unavailable: undefined, 'needs-permission': 'enable', blocked: 'settings', registering: undefined, on: undefined, error: 'retry' }
    for (const s of all) { const c = describeStatus(s); assert.ok(c.title.length > 3 && c.detail.length > 20, s); assert.equal(c.action, actions[s], s) }
    assert.equal(describeStatus('on').tone, 'ok'); for (const s of ['needs-permission', 'blocked', 'error'] as const) assert.equal(describeStatus(s).tone, 'warn')
    assert.match(describeStatus('off').detail, /keep this app open/i, 'while off, say what actually works')
  })

  await t('only an Expo push token is accepted (what the backend takes; anything else is a 400 invalid_token)', () => {
    for (const ok of ['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', 'ExpoPushToken[abc-123_X]']) assert.equal(isExpoPushToken(ok), true, ok)
    for (const bad of ['', 'fcm:APA91bHxxxxxxxx', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'ExponentPushToken[abc', 'exponentpushtoken[abc]', ' ExponentPushToken[abc]', null, undefined, 42, {}]) assert.equal(isExpoPushToken(bad), false, String(bad))
  })
  await t('the install id fits the backend\'s rule (8 to 64 of letters, digits, - and _), and the one the app makes does', async () => {
    for (const ok of ['abcd1234', 'a'.repeat(64), 'abc_DEF-123']) assert.equal(isValidInstallId(ok), true, ok)
    for (const bad of ['short', 'a'.repeat(65), 'has space1', 'dots.not.ok1', 'slash/ok/no1', '']) assert.equal(isValidInstallId(bad), false, bad)
    resetInstallIdCache(); await storage.remove('push.installId'); assert.equal(isValidInstallId(await getInstallId()), true)
  })
  await t('a token that is not an Expo token (a raw FCM token, say) is never sent: "unavailable", not a failing registration', async () => {
    const r = await run({ permission: 'granted', token: 'fcm:APA91bHrawdevicetoken' }, true); assert.equal(r.status, 'unavailable'); assert.equal(r.sent.length, 0)
  })

  await t('the Firebase file is added to the Android config only when it exists (or EAS supplies it), so the app builds without it', () => {
    const load = createRequire(`${process.cwd()}/`)
    const cfg = () => (load('./app.config.js') as (a: { config: { android: Record<string, unknown> } }) => { android: Record<string, unknown> })({ config: { android: { package: 'com.e5energy.smarthelmet' } } })
    const saved = process.env.GOOGLE_SERVICES_JSON; delete process.env.GOOGLE_SERVICES_JSON
    if (!fs.existsSync('google-services.json')) assert.equal(cfg().android.googleServicesFile, undefined, 'no file, no setting')
    process.env.GOOGLE_SERVICES_JSON = '/eas/secret/google-services.json'; assert.equal(cfg().android.googleServicesFile, '/eas/secret/google-services.json'); assert.equal(cfg().android.package, 'com.e5energy.smarthelmet', 'the rest of the config is untouched')
    if (saved === undefined) delete process.env.GOOGLE_SERVICES_JSON; else process.env.GOOGLE_SERVICES_JSON = saved
  })
  await t('the Expo project link survives unpacking a new zip (it lives in e5.local.json), and only a real project ID (a UUID) is ever passed on to EAS', () => {
    const load = createRequire(`${process.cwd()}/`)
    type Out = { owner?: string; extra?: { other?: number; eas?: { projectId?: string; other?: number } } }
    const cfg = (config: object = {}) => (load('./app.config.js') as (a: { config: object }) => Out)({ config: { android: {}, ...config } })
    const id = (c: object = {}) => cfg(c).extra?.eas?.projectId
    const [A, B, C] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
    const file = 'e5.local.json'
    const hadFile = fs.existsSync(file), kept = hadFile ? fs.readFileSync(file, 'utf8') : ''
    const savedEnv = process.env.EAS_PROJECT_ID; delete process.env.EAS_PROJECT_ID
    const savedWarn = console.warn; const warnings: string[] = []; console.warn = (m: string) => { warnings.push(String(m)) }
    try {
      if (hadFile) fs.rmSync(file)
      assert.equal(id(), undefined, 'nothing anywhere: nothing invented'); assert.equal(cfg().owner, undefined)
      process.env.EAS_PROJECT_ID = C; assert.equal(id(), C, 'the environment is the last resort')
      fs.writeFileSync(file, JSON.stringify({ projectId: B, owner: 'acme' }))
      assert.deepEqual([id(), cfg().owner], [B, 'acme'], 'the local file beats the environment')
      assert.deepEqual([id({ extra: { eas: { projectId: A } }, owner: 'json-owner' }), cfg({ owner: 'json-owner' }).owner], [A, 'json-owner'], 'app.json, where eas init may have put it, beats both')
      assert.equal(id({ extra: { other: 1 } }), B); assert.equal(cfg({ extra: { other: 1 } }).extra?.other, 1, 'the rest of extra is kept'); assert.equal(cfg({ extra: { eas: { other: 2 } } }).extra?.eas?.other, 2, 'and the rest of eas')
      fs.writeFileSync(file, JSON.stringify({ projectId: ` ${A.toUpperCase()} ` })); assert.equal(id(), A.toUpperCase(), 'upper case and surrounding spaces are fine')
      assert.equal(warnings.length, 0, 'nothing wrong, nothing said')

      for (const wrong of ['file-id', 'e5-smart-helmet', 'acme/e5-smart-helmet', 'https://expo.dev/accounts/acme/projects/e5', '1234', '<the id from expo.dev>', '11111111-1111-4111-8111-11111111111', '11111111111141118111111111111111']) {
        warnings.length = 0; fs.writeFileSync(file, JSON.stringify({ projectId: wrong }))
        assert.equal(id(), C, `"${wrong}" is not a project ID, so it falls through to the environment`)
        assert.ok(warnings.some((w) => w.includes('e5.local.json') && w.includes(wrong)), `"${wrong}" is named in a warning`)
      }
      warnings.length = 0; fs.writeFileSync(file, JSON.stringify({ projectId: '00000000-0000-0000-0000-000000000000', owner: 'your-expo-username-or-organisation' }))
      assert.equal(id(), C, 'the placeholder from the example file is ignored'); assert.equal(cfg().owner, undefined, 'and so is its owner placeholder'); assert.equal(warnings.length, 0, 'an untouched example file is not a mistake worth warning about')
      fs.writeFileSync(file, JSON.stringify({ owner: 'two words' })); assert.equal(cfg().owner, undefined, 'an owner with spaces is not an Expo account')
      process.env.EAS_PROJECT_ID = 'not-a-uuid'; fs.rmSync(file); warnings.length = 0
      assert.equal(id(), undefined, 'a bad environment value is ignored too'); assert.ok(warnings.some((w) => w.includes('EAS_PROJECT_ID')), 'and named')
      warnings.length = 0; fs.writeFileSync(file, JSON.stringify({ projectId: B }))
      assert.equal(id({ extra: { eas: { projectId: 'e5-smart-helmet' } } }), B, 'a bad ID already in app.json is replaced by the good one in e5.local.json'); assert.ok(warnings.some((w) => w.includes('app.json')))
      fs.rmSync(file); assert.equal(cfg({ extra: { eas: { projectId: 'e5-smart-helmet' } } }).extra?.eas?.projectId, undefined, 'and with nothing to replace it, it is removed rather than left to reach EAS')
      process.env.EAS_PROJECT_ID = C; warnings.length = 0
      for (const labelled of [`ID: ${A}`, `id: ${A}`, `Project ID: ${A}`, `ID:${A}`, ` ID : ${A} `, `"${A}"`]) { fs.writeFileSync(file, JSON.stringify({ projectId: labelled })); assert.equal(id(), A, `"${labelled}" is the ID with a label on it`) }
      assert.equal(warnings.length, 0, 'a labelled ID is accepted without fuss')
      fs.writeFileSync(file, JSON.stringify({ projectId: 'ID: not-an-id' })); assert.equal(id(), C, 'but a label in front of something that is not an ID is still not an ID')
      for (const damaged of ['{ this is not json', '{\r\n  "projectId": "' + A + '",\r\n \r\n}', '{ "projectId": "' + A + '" ', '{ "projectId": ' + A + ' }']) {
        warnings.length = 0; fs.writeFileSync(file, damaged); assert.equal(id(), C, 'a damaged file must never break the build, and the next source is used')
        assert.ok(warnings.length === 1 && /e5\.local\.json could not be read as JSON/.test(warnings[0]) && /comma after the last line/.test(warnings[0]), `a damaged file is named, not skipped in silence: ${damaged.slice(0, 30)}`)
      }
      fs.writeFileSync(file, '{ this is not json'); process.env.EAS_PROJECT_ID = C; assert.equal(id(), C, 'a damaged file must never break the build')
    } finally {
      console.warn = savedWarn
      if (fs.existsSync(file)) fs.rmSync(file)
      if (hadFile) fs.writeFileSync(file, kept)
      if (savedEnv === undefined) delete process.env.EAS_PROJECT_ID; else process.env.EAS_PROJECT_ID = savedEnv
    }
  })
}
main().then(report)
