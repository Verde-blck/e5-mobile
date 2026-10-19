import assert from 'node:assert/strict'
import { env } from '@/config/env'
import { tokenStore, decodeToken, isExpired } from '@/shared/lib/token'
import { onUnauthorized } from '@/shared/lib/unauthorized'
import { isForbidden, missingPermission } from '@/shared/lib/errors'
import { safeKey } from '@/shared/lib/storage'
import { endSession } from '@/shared/lib/session'
import { queryClient } from '@/shared/lib/query-client'
import { useAuthStore } from '@/shared/store/authStore'
import { ALL_PERMISSIONS } from '@/shared/constants/modules'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import { num, flag, ts, pageContent, parseGasData, shortDeviceName } from '@/shared/lib/api-normalize'
import * as auth from '@/modules/auth/api/auth.api'
import { fetchDevices, fetchFleetSummary } from '@/modules/devices/api/devices.api'
import { derivePresence, formatLastSeen, lastSeenLabel, ONLINE_WINDOW_MS, DEGRADED_WINDOW_MS } from '@/modules/devices/lib/presence'
import { describeFix, gpsLevelLabel, networkLabel, simLabel } from '@/modules/devices/lib/location'
import { alarmLabel, alarmTypeFromCode, isSos, severityForType } from '@/modules/alarms/types'
import { fetchAlarmDetail, fetchAlarms, setAlarmResolved, toAlarm, toAlarmDetail } from '@/modules/alarms/api/alarms.api'
import { expectsFootage, videoStatus } from '@/modules/alarms/footage'
import { ALERT_WINDOW_MS, FRESH_MS, arrivalAlert, criticalActive } from '@/modules/alarms/lib/alert-policy'
import { upsertAlarm } from '@/modules/alarms/lib/alarm-cache'
import { alarmCursor, streamStatus } from '@/modules/alarms/lib/alarmStream'
import { useAlertStore } from '@/modules/alarms/store/alertStore'
import { createRunner, future, installHttp, jwt, past } from './harness'
// @ts-ignore stub
import { __mem } from 'expo-secure-store'

const { t, report } = createRunner()
const http = installHttp()
const MIN = 60_000

const SUPER_ME = { username: 'admin', roleName: null, superAdmin: true, permissions: [], deviceIds: [], twoFactorEnabled: true }
const VIEWER_ME = { username: 'roletest', roleName: 'Viewer', superAdmin: false, permissions: ['DASHBOARD', 'TRACK_PLAYBACK'], deviceIds: [], twoFactorEnabled: false }

async function main() {
  assert.equal(env.useMocks, false, 'live suite must run with mocks off')
  assert.equal(env.apiBaseUrl, 'https://e5energy-production.up.railway.app/api')

  // ---------- normalisers ----------
  await t('num/flag/ts behave like the web versions', () => {
    assert.equal(num('83'), 83); assert.equal(num(''), undefined); assert.equal(num('abc'), undefined)
    assert.equal(flag('1'), true); assert.equal(flag('0'), false); assert.equal(flag(null), undefined)
    assert.equal(ts('2026-09-18T16:20:40.079727Z'), Date.parse('2026-09-18T16:20:40.079727Z'))
    assert.deepEqual(pageContent({ content: [1, 2] } as any), [1, 2]); assert.deepEqual(pageContent(null), [])
  })
  await t('parseGasData drops unfitted sensors instead of reporting zero', () => {
    const g = parseGasData('CH4--0.0;O2--20.9;CO--0.0;H2S--0.0;NH3--;CH2O--;NO2--;SF6--;H2--')
    assert.deepEqual(g, [{ gas: 'CH4', value: 0 }, { gas: 'O2', value: 20.9 }, { gas: 'CO', value: 0 }, { gas: 'H2S', value: 0 }])
    assert.equal(shortDeviceName('866652022956404'), '…56404')
  })

  // ---------- token storage ----------
  await t('storage keys are sanitised for SecureStore', () => assert.equal(safeKey('e5.twoFactor.ADM@001'), 'e5.twoFactor.ADM_001'))
  await t('decodeToken / isExpired (30 s skew)', () => {
    assert.equal(decodeToken(jwt({ sub: 'admin', exp: future }))?.sub, 'admin'); assert.equal(decodeToken('nonsense'), null)
    assert.equal(isExpired(jwt({ exp: past })), true); assert.equal(isExpired(jwt({ exp: future })), false)
    assert.equal(isExpired(jwt({ exp: future - 3590 })), true)
  })
  await t('tokenStore mirrors to memory + keychain; load restores valid and purges expired', async () => {
    const tok = jwt({ sub: 'x', exp: future })
    await tokenStore.set(tok); assert.equal(tokenStore.get(), tok); assert.equal(__mem.get('authToken'), tok)
    await tokenStore.clear(); assert.equal(tokenStore.get(), null); assert.equal(__mem.has('authToken'), false)
    __mem.set('authToken', tok); assert.ok(await tokenStore.load())
    __mem.set('authToken', jwt({ sub: 'x', exp: past })); assert.equal(await tokenStore.load(), null)
    assert.equal(__mem.has('authToken'), false)
  })

  // ---------- roles: permission codes -> module:action ----------
  await t('expandPermissions: Cypher\'s "Viewer" test role (DASHBOARD + TRACK_PLAYBACK)', () => {
    assert.deepEqual(expandPermissions(['DASHBOARD', 'TRACK_PLAYBACK']).sort(), ['dashboard:read', 'trackPlayback:read'])
  })
  await t('expandPermissions: _MANAGE includes view; Wi-Fi follows Unit Setting; unknown and retired codes are safe', () => {
    assert.deepEqual(expandPermissions(['ALARM_RECORD_MANAGE']).sort(), ['alarms:delete', 'alarms:read', 'alarms:write'])
    assert.deepEqual(expandPermissions(['UNIT_SETTING']).sort(), ['unitSettings:read', 'wifi:read'])
    assert.deepEqual(expandPermissions(['NOT_A_REAL_CODE']), [])
    assert.deepEqual(expandPermissions(['GEO_FENCE', 'FENCE']), [], 'GEO_FENCE is retired and means FENCE')
    assert.ok(expandPermissions(['MONITORING_CENTER']).includes('devices:read'))
    for (const p of expandPermissions(['MONITORING_CENTER_MANAGE', 'GROUP_SETTING', 'ADMINISTRATOR_SETTING', 'PHOTO_RECORD', 'VIDEO_RECORD_MANAGE']))
      assert.ok(ALL_PERMISSIONS.includes(p), `${p} must be a real module:action`)
  })

  // ---------- sign-in, /auth/me ----------
  const adminToken = jwt({ sub: 'admin', exp: future })
  await t('login: POST /auth/login, then GET /auth/me with the bearer token; super admin = everything', async () => {
    http.calls.length = 0
    http.routes = { 'POST /auth/login': () => ({ status: 200, data: { token: adminToken } }), 'GET /auth/me': () => ({ status: 200, data: SUPER_ME }) }
    const r = await auth.login({ username: 'admin', password: 'pw' })
    assert.equal(r.status, 'signed-in')
    if (r.status !== 'signed-in') return
    assert.equal(r.user.superAdmin, true); assert.equal(r.user.role, 'Super admin')
    assert.equal(r.user.permissions.length, ALL_PERMISSIONS.length); assert.equal(r.user.twoFactorEnabled, true)
    assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['POST /auth/login', 'GET /auth/me'])
    assert.equal(http.calls[0].baseURL, 'https://e5energy-production.up.railway.app/api')
    assert.equal(http.calls[1].auth, `Bearer ${adminToken}`)
    assert.equal(tokenStore.get(), adminToken)
  })
  const viewerToken = jwt({ sub: 'roletest', exp: future })
  await t('login as the Viewer role: only the permitted screens, role name shown, 2FA flag from the server', async () => {
    http.routes = { 'POST /auth/login': () => ({ status: 200, data: { token: viewerToken } }), 'GET /auth/me': () => ({ status: 200, data: VIEWER_ME }) }
    const r = await auth.login({ username: 'roletest', password: 'Test12345' })
    assert.equal(r.status === 'signed-in' && r.user.role, 'Viewer')
    assert.deepEqual(r.status === 'signed-in' && [...r.user.permissions].sort(), ['dashboard:read', 'trackPlayback:read'])
    assert.equal(r.status === 'signed-in' && r.user.twoFactorEnabled, false)
  })
  await t('a limited account carries its helmet list; a role-less account is labelled, not crashed', async () => {
    assert.deepEqual(auth.userFromProfile({ username: 'a', deviceIds: ['1', '2'], permissions: ['DASHBOARD'] }, 'a').deviceIds, ['1', '2'])
    const bare = auth.userFromProfile({ username: 'b' }, 'b')
    assert.equal(bare.role, 'No role'); assert.deepEqual(bare.permissions, []); assert.deepEqual(bare.deviceIds, [])
  })
  await t('login with 2FA: returns a challenge, stores NO token; verify then loads the profile', async () => {
    await tokenStore.clear(); http.calls.length = 0
    http.routes = {
      'POST /auth/login': () => ({ status: 200, data: { requires2fa: true, mfaToken: 'm-123' } }),
      'POST /auth/login/verify-2fa': () => ({ status: 200, data: { token: adminToken } }),
      'GET /auth/me': () => ({ status: 200, data: SUPER_ME }),
    }
    const r = await auth.login({ username: 'admin', password: 'pw' })
    assert.equal(r.status, 'needs-code'); assert.equal(tokenStore.get(), null)
    if (r.status !== 'needs-code') return
    assert.deepEqual(r.challenge, { username: 'admin', mfaToken: 'm-123' })
    const u = await auth.verifyTwoFactorLogin(r.challenge, '654321')
    assert.deepEqual(http.calls[1].data, { username: 'admin', code: '654321', mfaToken: 'm-123' })
    assert.equal(u.username, 'admin'); assert.equal(tokenStore.get(), adminToken)
  })
  await t('verify omits mfaToken when the backend never issued one', async () => {
    http.calls.length = 0
    await auth.verifyTwoFactorLogin({ username: 'admin' }, '111111')
    assert.deepEqual(http.calls[0].data, { username: 'admin', code: '111111' })
  })
  await t('if the profile can\'t be loaded the token is dropped: never half signed-in', async () => {
    await tokenStore.clear()
    http.routes = { 'POST /auth/login': () => ({ status: 200, data: { token: adminToken } }), 'GET /auth/me': () => ({ status: 500 }) }
    await assert.rejects(auth.login({ username: 'admin', password: 'pw' }))
    assert.equal(tokenStore.get(), null); assert.equal(__mem.has('authToken'), false)
  })
  await t('2FA management endpoints; refreshProfile re-reads the real flag', async () => {
    http.calls.length = 0
    http.routes = {
      'POST /auth/2fa/setup': () => ({ status: 200, data: { secret: 'ABCD', otpAuthUrl: 'otpauth://totp/x?secret=ABCD' } }),
      'POST /auth/2fa/confirm': () => ({ status: 200, data: {} }),
      'POST /auth/2fa/disable': () => ({ status: 200, data: {} }),
      'GET /auth/me': () => ({ status: 200, data: { ...VIEWER_ME, twoFactorEnabled: true } }),
    }
    assert.equal((await auth.startTwoFactorSetup('admin')).secret, 'ABCD')
    await auth.confirmTwoFactorSetup('admin', '123456'); await auth.disableTwoFactor('admin', '123456')
    assert.equal((await auth.refreshProfile('roletest')).twoFactorEnabled, true)
    assert.deepEqual(http.calls.slice(0, 3).map((c) => c.data), [undefined, { code: '123456' }, { code: '123456' }])
  })

  // ---------- restoring a session ----------
  await t('restoreSession: valid token -> profile from /auth/me', async () => {
    await tokenStore.set(viewerToken)
    http.routes = { 'GET /auth/me': () => ({ status: 200, data: VIEWER_ME }) }
    assert.equal((await auth.restoreSession())?.role, 'Viewer')
  })
  await t('restoreSession: offline -> last known profile, token kept', async () => {
    http.routes = { 'GET /auth/me': () => ({ status: 0 }) }
    const u = await auth.restoreSession()
    assert.equal(u?.username, 'roletest'); assert.ok(__mem.has('authToken'), 'token must survive being offline')
  })
  await t('restoreSession: offline and the cached profile belongs to someone else -> no session, token kept', async () => {
    await tokenStore.set(jwt({ sub: 'someone-else', exp: future }))
    assert.equal(await auth.restoreSession(), null); assert.ok(__mem.has('authToken'))
  })
  await t('restoreSession: token rejected (401, or bare 403) -> dead session, token and profile cleared', async () => {
    for (const status of [401, 403]) {
      await tokenStore.set(viewerToken); __mem.set('e5.profile', '{"username":"roletest","permissions":[]}')
      http.routes = { 'GET /auth/me': () => ({ status }) }
      assert.equal(await auth.restoreSession(), null)
      assert.equal(__mem.has('authToken'), false, `status ${status}`); assert.equal(__mem.has('e5.profile'), false)
    }
  })
  await t('restoreSession: no token -> null without any request', async () => {
    http.calls.length = 0; await tokenStore.clear()
    assert.equal(await auth.restoreSession(), null); assert.equal(http.calls.length, 0)
  })

  // ---------- 401 / 403 ----------
  let fired = 0
  const off = onUnauthorized(() => { fired++ })
  await t('a 401, or a 403 WITHOUT the forbidden body, ends the session', async () => {
    fired = 0
    http.routes = { 'GET /devices': () => ({ status: 401 }), 'GET /dashboard/summary': () => ({ status: 403 }) }
    await assert.rejects(fetchDevices()); await assert.rejects(fetchFleetSummary())
    assert.equal(fired, 2)
  })
  await t('a permission refusal (403 {"error":"forbidden"}) does NOT end the session', async () => {
    fired = 0
    http.routes = {
      'GET /alarms/81': () => ({ status: 403, data: { error: 'forbidden', permission: 'PHOTO_RECORD' } }),
      'GET /devices': () => ({ status: 403, data: { error: 'forbidden', deviceId: '866652022956404' } }),
    }
    const e1 = await fetchAlarmDetail('81').catch((e) => e)
    assert.equal(isForbidden(e1), true); assert.equal(missingPermission(e1), 'PHOTO_RECORD')
    await assert.rejects(fetchDevices())
    assert.equal(fired, 0, 'restricted accounts must not be signed out for tapping something they can\'t use')
  })
  await t('a wrong password/code is not a dead session', async () => {
    fired = 0
    http.routes = { 'POST /auth/login': () => ({ status: 401 }), 'POST /auth/login/verify-2fa': () => ({ status: 401 }), 'POST /auth/2fa/confirm': () => ({ status: 401 }), 'POST /auth/2fa/disable': () => ({ status: 401 }) }
    await assert.rejects(auth.login({ username: 'a', password: 'b' })); await assert.rejects(auth.verifyTwoFactorLogin({ username: 'a' }, '0'))
    await assert.rejects(auth.confirmTwoFactorSetup('a', '0')); await assert.rejects(auth.disableTwoFactor('a', '0'))
    assert.equal(fired, 0)
  })
  off()
  await t('describeAuthError maps statuses to sentences', () => {
    const e = (status?: number) => (status ? { response: { status } } : new Error('Network Error'))
    assert.equal(auth.describeAuthError(e(401), 'WRONG'), 'WRONG'); assert.match(auth.describeAuthError(e(429), 'x'), /Too many/)
    assert.match(auth.describeAuthError(e(503), 'x'), /server had a problem/); assert.match(auth.describeAuthError(e(), 'x'), /Can't reach the server/)
  })

  // ---------- devices: Cypher's 16 Oct fields ----------
  await t('fetchDevices maps names, numbers, gas, and the new location/SIM fields (the real "ES5 3" sample)', async () => {
    http.routes = { 'GET /devices': () => ({ status: 200, data: [
      { deviceId: '866652022956057', name: 'ES5 3', lastBatteryLevel: '83', lastLatitude: '6.567546', lastLongitude: '3.369325', lastWearStatus: '1',
        lastNetStrength: '4', lastSeenAt: '2026-10-16T10:00:00Z', active: true, lastFixType: 'gps', lastGpsLevel: '1', lastAccuracyMeters: 2.6,
        simStatus: 1, simPhoneNumber: null, simDataUsedMb: 0.0, networkType: 'wifi', online: true,
        lastRawGasData: 'CH4--0.0;O2--20.9;NH3--', lastGasAt: '2026-10-16T09:59:30Z' },
      { deviceId: '866652022957881', name: '   ', lastSeenAt: null, lastFixType: 'network', lastAccuracyMeters: 640, simStatus: 2, simPhoneNumber: ' +234 803 555 0142 ', networkType: '4g' },
      { deviceId: '866652022958103', lastFixType: 'something-new' },
    ] }) }
    const [a, b, c] = await fetchDevices()
    assert.equal(a.name, 'ES5 3'); assert.equal(a.named, true); assert.equal(a.telemetry.signalStrength, 4)
    assert.equal(a.telemetry.fixType, 'gps'); assert.equal(a.telemetry.gpsLevel, 1); assert.equal(a.telemetry.accuracyMeters, 2.6)
    assert.equal(a.telemetry.simStatus, 1); assert.equal(a.telemetry.simPhoneNumber, undefined); assert.equal(a.telemetry.simDataUsedMb, 0)
    assert.equal(a.connectivity, 'wifi'); assert.equal(a.telemetry.networkType, 'wifi')
    assert.deepEqual(a.telemetry.gas, [{ gas: 'CH4', value: 0 }, { gas: 'O2', value: 20.9 }])
    assert.equal(b.name, '…57881'); assert.equal(b.named, false); assert.equal(b.lastSeenAt, 0); assert.equal(b.connectivity, 'sim')
    assert.equal(b.telemetry.fixType, 'network'); assert.equal(b.telemetry.simPhoneNumber, '+234 803 555 0142'); assert.equal(b.telemetry.batteryPercent, undefined)
    assert.equal(c.telemetry.fixType, 'other', 'an unrecognised fix type degrades to "other", not a crash')
  })
  await t('location wording: GPS is exact; network/Wi-Fi/other read as approximate', () => {
    assert.deepEqual(describeFix({ fixType: 'gps', accuracyMeters: 2.6 }), { label: 'GPS · ±2.6 m', approximate: false })
    assert.deepEqual(describeFix({ fixType: 'network', accuracyMeters: 640 }), { label: 'Mobile network · ±640 m', approximate: true })
    assert.equal(describeFix({ fixType: 'wifi' })?.approximate, true); assert.equal(describeFix({ fixType: 'other' })?.approximate, true)
    assert.equal(describeFix({}), null)
    assert.equal(gpsLevelLabel(1), 'Strong'); assert.equal(gpsLevelLabel(0), 'Weak'); assert.equal(gpsLevelLabel(-1), 'No GPS signal'); assert.equal(gpsLevelLabel(undefined), null)
    assert.equal(simLabel(1), 'SIM present'); assert.equal(simLabel(2), 'No SIM'); assert.equal(simLabel(0), 'Unknown'); assert.equal(simLabel(undefined), 'Unknown')
    assert.equal(networkLabel('wifi'), 'Wi-Fi'); assert.equal(networkLabel('4g'), '4G'); assert.equal(networkLabel(undefined), null)
  })

  // ---------- presence ----------
  await t('presence follows the web rules: online < 2 min, degraded < 10 min, else offline', () => {
    const now = 1_000_000_000_000
    assert.equal(ONLINE_WINDOW_MS, 120_000); assert.equal(DEGRADED_WINDOW_MS, 600_000)
    assert.equal(derivePresence(now - 30_000, now), 'online'); assert.equal(derivePresence(now - ONLINE_WINDOW_MS, now), 'degraded')
    assert.equal(derivePresence(now - DEGRADED_WINDOW_MS, now), 'offline'); assert.equal(derivePresence(0, now), 'offline')
    assert.equal(formatLastSeen(now - 30_000, now), '30s ago'); assert.equal(formatLastSeen(now - 5 * MIN, now), '5m ago')
    assert.equal(lastSeenLabel(0, now), 'never')
  })

  // ---------- alarms ----------
  await t('alarm vocabulary: protocol codes, SOS variants, derived severity (matches Cypher\'s critical list)', () => {
    assert.equal(alarmTypeFromCode('7'), 'sos'); assert.equal(alarmTypeFromCode('manual_sos_button'), 'sos-button'); assert.equal(alarmTypeFromCode('99'), 'other')
    assert.ok(isSos('sos') && isSos('sos-button') && !isSos('fall'))
    for (const code of ['7', 'manual_sos_button', '4', '11', '6']) assert.equal(severityForType(alarmTypeFromCode(code)), 'critical', code)
    for (const code of ['1', '2', '5', 'voice_message', '21']) assert.equal(severityForType(alarmTypeFromCode(code)), 'warning', code)
    assert.equal(alarmLabel('near-electric'), 'Near live electricity')
  })
  await t('toAlarm maps a real stream event (alarm 77, an SOS button press)', () => {
    const a = toAlarm({ id: 77, deviceId: '866652022956057', alarmType: 'manual_sos_button', latitude: '6.567546333333334', longitude: '3.3693255', occurredAt: '2026-10-16T15:38:57.688565Z', resolved: false })
    assert.equal(a.id, '77'); assert.equal(a.type, 'sos-button'); assert.equal(a.severity, 'critical'); assert.equal(a.status, 'active')
    assert.equal(a.lat, 6.567546333333334); assert.equal(a.raisedAt, Date.parse('2026-10-16T15:38:57.688565Z'))
    assert.equal(toAlarm({ id: 1, deviceId: 'x', alarmType: '2', latitude: null, longitude: null, resolved: true }).lat, undefined)
  })
  await t('list + resolve/reopen use the documented endpoints', async () => {
    http.calls.length = 0
    http.routes = {
      'GET /alarms': () => ({ status: 200, data: { content: [{ id: 77, deviceId: 'a', alarmType: '7', resolved: false }, { id: 76, deviceId: 'b', alarmType: '1', resolved: true }] } }),
      'PATCH /alarms/77/resolve': () => ({ status: 200 }), 'PATCH /alarms/77/unresolve': () => ({ status: 200 }),
    }
    assert.deepEqual((await fetchAlarms()).map((a) => [a.id, a.status]), [['77', 'active'], ['76', 'resolved']])
    assert.deepEqual(http.calls[0].params, { page: 0, size: 200 })
    await setAlarmResolved('77', true); await setAlarmResolved('77', false)
    assert.deepEqual(http.calls.slice(1).map((c) => `${c.method} ${c.url}`), ['PATCH /alarms/77/resolve', 'PATCH /alarms/77/unresolve'])
  })
  await t('alarm detail maps linked footage (the real alarm 81 sample); the zone-less clip time is shown as a clock, not converted', async () => {
    http.routes = { 'GET /alarms/81': () => ({ status: 200, data: {
      id: 81, deviceId: '866652022956057', alarmType: 'voice_message', latitude: null, longitude: null, occurredAt: '2026-10-16T21:35:26.587804Z', resolved: false,
      photos: [{ id: 38, deviceId: '866652022956057', imageUrl: 'https://x/p.jpg?X-Amz=1', latitude: '6.5677', longitude: '3.3693', alarmId: 81, capturedAt: '2026-10-16T21:35:42.336915Z' }, { id: 39, imageUrl: null }],
      videos: [
        { id: 40, deviceId: 'd', videoUrl: 'https://x/b.mp4', fileName: '20261016223526.mp4', fileSizeBytes: 3807380, recordedAt: '2026-10-16T22:35:26', alarmId: 81 },
        { id: 41, deviceId: 'd', videoUrl: 'https://x/a.mp4', fileName: '20261016223226.mp4', recordedAt: '2026-10-16T22:32:26', alarmId: 81 },
        { id: 42, videoUrl: null },
      ] } }) }
    const d = await fetchAlarmDetail('81')
    assert.equal(d.alarm.type, 'voice-message'); assert.equal(d.photos.length, 1, 'an item with no URL is dropped')
    assert.equal(d.photos[0].url, 'https://x/p.jpg?X-Amz=1'); assert.equal(d.photos[0].capturedAt, Date.parse('2026-10-16T21:35:42.336915Z'))
    assert.deepEqual(d.videos.map((v) => [v.fileName, v.recordedClock]), [['20261016223226.mp4', '22:32'], ['20261016223526.mp4', '22:35']], 'sorted oldest-first by file name')
    assert.equal(d.videos[1].sizeBytes, 3807380)
  })
  await t('footage rules: which alarms get footage, and when "uploading" turns into "none"', () => {
    const alarm = (type: string, agoMs: number) => toAlarm({ id: 1, deviceId: 'd', alarmType: type, occurredAt: new Date(Date.now() - agoMs).toISOString() })
    const detail = (type: string, agoMs: number, videos = 0) => toAlarmDetail({ id: 1, deviceId: 'd', alarmType: type, occurredAt: new Date(Date.now() - agoMs).toISOString(), videos: Array.from({ length: videos }, (_, i) => ({ id: i, deviceId: 'd', videoUrl: 'u', fileName: `${i}.mp4` })) })
    for (const code of ['7', '4', '11']) assert.equal(expectsFootage(alarm(code, 0).type), true, code)
    for (const code of ['manual_sos_button', '6', '1', 'voice_message']) assert.equal(expectsFootage(alarm(code, 0).type), false, code)
    const now = Date.now()
    assert.equal(videoStatus(detail('4', 10 * MIN), now), 'uploading'); assert.equal(videoStatus(detail('4', 4 * 60 * MIN), now), 'none')
    assert.equal(videoStatus(detail('4', 10 * MIN, 1), now), 'ready'); assert.equal(videoStatus(detail('manual_sos_button', MIN), now), 'none')
  })
  await t('alert policy: critical alarms ring inside the 30-minute window; others chime once, only if fresh', () => {
    const now = 1_000_000_000_000
    const mk = (id: string, code: string, agoMs: number, resolved = false) => toAlarm({ id: Number(id), deviceId: 'd', alarmType: code, occurredAt: new Date(now - agoMs).toISOString(), resolved })
    const list = [mk('1', '7', 5 * MIN), mk('2', '4', 29 * MIN), mk('3', '4', 31 * MIN), mk('4', '7', MIN, true), mk('5', '1', MIN), mk('6', 'manual_sos_button', 2 * MIN)]
    assert.deepEqual(criticalActive(list, now).map((a) => a.id), ['6', '1', '2'], 'newest first; resolved, stale and warning alarms excluded')
    assert.equal(ALERT_WINDOW_MS, 30 * MIN)
    assert.equal(arrivalAlert(mk('9', '1', 10_000), now), 'chime'); assert.equal(arrivalAlert(mk('9', '1', FRESH_MS + 1), now), 'none', 'a replayed old alarm must not chime')
    assert.equal(arrivalAlert(mk('9', '7', 1_000), now), 'none', 'critical is handled by the siren, not a chime')
    assert.equal(arrivalAlert(mk('9', '1', 1_000, true), now), 'none')
  })
  await t('upsertAlarm: new alarms go on top; an update flips status and records when it was resolved locally', () => {
    const now = 5_000_000
    const a = toAlarm({ id: 1, deviceId: 'd', alarmType: '7', resolved: false }); const b = toAlarm({ id: 2, deviceId: 'd', alarmType: '1', resolved: false })
    const withNew = upsertAlarm([a], b, now); assert.deepEqual(withNew.map((x) => x.id), ['2', '1'])
    const resolved = upsertAlarm(withNew, { ...a, status: 'resolved' }, now)
    assert.equal(resolved.length, 2); assert.equal(resolved[1].status, 'resolved'); assert.equal(resolved[1].resolvedAt, now)
    const reopened = upsertAlarm(resolved, { ...a, status: 'active' }, now + 1)
    assert.equal(reopened[1].status, 'active'); assert.equal(reopened[1].resolvedAt, undefined)
    assert.equal(withNew.length, 2, 'the input list is never mutated')
  })

  // ---------- teardown ----------
  await t('endSession clears user, cache, token, profile, alarm cursor and silenced sirens', async () => {
    await tokenStore.set(adminToken); __mem.set('e5.profile', '{}')
    useAuthStore.getState().setUser({ id: 'a', username: 'a', name: 'a', role: 'r', permissions: [] })
    queryClient.setQueryData(['devices'], [1]); alarmCursor.set(77); streamStatus.set('open'); useAlertStore.getState().silence(['77'])
    await endSession()
    assert.equal(useAuthStore.getState().isAuthenticated, false); assert.equal(queryClient.getQueryData(['devices']), undefined)
    assert.equal(tokenStore.get(), null); assert.equal(__mem.has('authToken'), false); assert.equal(__mem.has('e5.profile'), false)
    assert.equal(alarmCursor.get(), undefined, 'the next account must not inherit this one\'s stream position')
    assert.equal(streamStatus.get(), 'down'); assert.deepEqual(useAlertStore.getState().silenced, {})
  })
  await t('permission model matches the web: 12 modules x 3 actions', () => assert.equal(ALL_PERMISSIONS.length, 36))
}

main().then(report)
