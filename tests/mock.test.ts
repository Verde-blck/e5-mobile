import assert from 'node:assert/strict'
import { env } from '@/config/env'
import * as auth from '@/modules/auth/api/auth.api'
import { fetchDevices, fetchFleetSummary, fetchDevice } from '@/modules/devices/api/devices.api'
import { derivePresence } from '@/modules/devices/lib/presence'
import { fetchAlarmDetail, fetchAlarms, setAlarmResolved, toAlarm } from '@/modules/alarms/api/alarms.api'
import { simulateAlarm, subscribeMockStream } from '@/modules/alarms/api/alarms.mock'
import { videoStatus } from '@/modules/alarms/footage'
import { criticalActive } from '@/modules/alarms/lib/alert-policy'
import { tokenStore } from '@/shared/lib/token'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  assert.equal(env.useMocks, true)

  await t('ADM-001 is a super admin and signs straight in; no token is stored', async () => {
    const r = await auth.login({ username: 'adm-001', password: 'anything' })
    assert.equal(r.status, 'signed-in')
    if (r.status === 'signed-in') { assert.equal(r.user.username, 'ADM-001'); assert.equal(r.user.superAdmin, true); assert.equal(r.user.permissions.length, 36) }
    assert.equal(tokenStore.get(), null)
  })
  await t('OP-014 is a restricted account: no dashboard, but devices/map/alarms', async () => {
    const r = await auth.login({ username: 'OP-014', password: 'x' })
    assert.equal(r.status === 'signed-in' && r.user.permissions.includes('dashboard:read'), false)
    assert.equal(r.status === 'signed-in' && r.user.permissions.includes('alarms:read'), true)
    assert.equal(r.status === 'signed-in' && r.user.superAdmin, false)
  })
  await t('MFA-001: needs a code; a wrong code is a 401; switching 2FA off/on really changes the next sign-in', async () => {
    const r = await auth.login({ username: 'mfa-001', password: 'x' })
    assert.equal(r.status, 'needs-code'); if (r.status !== 'needs-code') return
    await assert.rejects(auth.verifyTwoFactorLogin(r.challenge, '000000'), (e: unknown) => auth.statusOf(e) === 401)
    const u = await auth.verifyTwoFactorLogin(r.challenge, '123456')
    assert.equal(u.username, 'MFA-001'); assert.equal(u.twoFactorEnabled, true)

    const setup = await auth.startTwoFactorSetup('MFA-001'); assert.match(setup.otpAuthUrl, /^otpauth:\/\/totp\/E5%20Energy%3AMFA-001\?secret=JBSWY3DPEHPK3PXP/)
    await assert.rejects(auth.disableTwoFactor('MFA-001', '111111'), (e: unknown) => auth.statusOf(e) === 401)
    await auth.disableTwoFactor('MFA-001', '123456')
    assert.equal((await auth.refreshProfile('MFA-001')).twoFactorEnabled, false)
    assert.equal((await auth.login({ username: 'MFA-001', password: 'x' })).status, 'signed-in', 'with 2FA off it signs straight in')
    await auth.confirmTwoFactorSetup('MFA-001', '123456')
    assert.equal((await auth.refreshProfile('MFA-001')).twoFactorEnabled, true)
    assert.equal((await auth.login({ username: 'MFA-001', password: 'x' })).status, 'needs-code')
  })
  await t('mock fleet spans online / degraded / offline / never-seen, signal is 0–5, and the summary agrees', async () => {
    const fleet = await fetchDevices(); const now = Date.now()
    const by = (p: string) => fleet.filter((d) => derivePresence(d.lastSeenAt, now) === p).length
    assert.ok(by('online') >= 2 && by('degraded') >= 1 && by('offline') >= 2)
    assert.ok(fleet.some((d) => d.lastSeenAt === 0) && fleet.some((d) => !d.named) && fleet.some((d) => d.named))
    assert.ok(fleet.every((d) => d.telemetry.signalStrength === undefined || (d.telemetry.signalStrength >= 0 && d.telemetry.signalStrength <= 5)))
    assert.ok(fleet.some((d) => d.telemetry.fixType === 'network') && fleet.some((d) => d.telemetry.fixType === 'gps'), 'both exact and approximate fixes are represented')
    const s = await fetchFleetSummary()
    assert.equal(s.total, fleet.length); assert.equal(s.online, by('online')); assert.equal(s.online + s.offline, s.total)
    assert.equal((await fetchDevice(fleet[0].id))?.name, fleet[0].name)
  })

  // ---------- sample alarms and the mock stream ----------
  await t('sample alarms go through the real mapping; a stale active critical alarm is listed but does not ring', async () => {
    const alarms = await fetchAlarms(); const now = Date.now()
    assert.ok(alarms.length >= 6); assert.ok(alarms.some((a) => a.type === 'sos-button') && alarms.some((a) => a.type === 'fall'))
    const fall = alarms.find((a) => a.id === '1006')!
    assert.equal(fall.status, 'active'); assert.equal(fall.severity, 'critical')
    assert.equal(criticalActive(alarms, now).some((a) => a.id === '1006'), false, 'it is 50 minutes old: past the 30-minute window')
  })
  await t('simulateAlarm emits through the stream path and appears in the list; resolving emits an update', async () => {
    const gotAlarm: number[] = []; const gotUpdate: boolean[] = []
    const off = subscribeMockStream((a) => gotAlarm.push(a.id), (a) => gotUpdate.push(a.resolved === true))
    const raw = simulateAlarm('manual_sos_button')
    assert.deepEqual(gotAlarm, [raw.id]); const mapped = toAlarm(raw)
    assert.equal(mapped.severity, 'critical'); assert.equal(criticalActive([mapped], Date.now()).length, 1, 'a fresh SOS rings')
    assert.ok((await fetchAlarms()).some((a) => a.id === String(raw.id)))
    await setAlarmResolved(String(raw.id), true); assert.deepEqual(gotUpdate, [true])
    assert.equal(criticalActive((await fetchAlarms()).filter((a) => a.id === String(raw.id)), Date.now()).length, 0, 'resolved -> the siren stops')
    off(); simulateAlarm('4'); assert.equal(gotAlarm.length, 1, 'unsubscribed listeners hear nothing')
  })
  await t('sample footage: an old SOS has a photo and a clip; the 50-min-old fall has its photo but its clip is "uploading"', async () => {
    const sos = await fetchAlarmDetail('1001'); assert.equal(sos.photos.length, 1); assert.equal(sos.videos.length, 1)
    assert.ok(sos.photos[0].url.length > 0 && sos.videos[0].url.length > 0); assert.equal(sos.videos[0].recordedClock, '10:15')
    assert.equal(videoStatus(sos, Date.now()), 'ready')
    const fall = await fetchAlarmDetail('1006'); assert.equal(fall.photos.length, 1); assert.equal(fall.videos.length, 0)
    assert.equal(videoStatus(fall, Date.now()), 'uploading')
    const button = await fetchAlarmDetail('1004'); assert.equal(videoStatus(button, Date.now()), 'none')
    await assert.rejects(fetchAlarmDetail('999999'), (e: unknown) => auth.statusOf(e) === 404)
  })
}

main().then(report)
