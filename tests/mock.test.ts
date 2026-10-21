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
import { ALL_PERMISSIONS } from '@/shared/constants/modules'
import * as settings from '@/modules/settings/api/settings.api'
import { TimeoutError, withTimeout } from '@/shared/lib/withTimeout'
import * as admins from '@/modules/users/api/admins.api'
import { fetchMessages, sendVoiceMessage } from '@/modules/messaging/api/messages.api'
import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { mockUserFor } from '@/modules/auth/mock-data'
import { useAuthStore } from '@/shared/store/authStore'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  assert.equal(env.useMocks, true)

  await t('ADM-001 is a super admin and signs straight in; no token is stored', async () => {
    const r = await auth.login({ username: 'adm-001', password: 'anything' })
    assert.equal(r.status, 'signed-in')
    if (r.status === 'signed-in') { assert.equal(r.user.username, 'ADM-001'); assert.equal(r.user.superAdmin, true); assert.equal(r.user.permissions.length, ALL_PERMISSIONS.length) }
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

  // ---------- settings and network, sample data ----------
  await t('sample site Wi-Fi: starts set; keeps its password when edited without one; can be removed', async () => {
    assert.deepEqual(await settings.fetchSiteWifi(), { ssid: 'E5ENERGY', passwordSet: true })
    assert.deepEqual(await settings.saveSiteWifi({ ssid: 'E5-SITE-2' }), { ssid: 'E5-SITE-2', passwordSet: true })
    await settings.removeSiteWifi(); assert.equal(await settings.fetchSiteWifi(), null)
    assert.deepEqual(await settings.saveSiteWifi({ ssid: 'OPEN-NET' }), { ssid: 'OPEN-NET', passwordSet: false }, 'no password given and none before = an open network')
  })
  await t('sample helmet settings: defaults, then a saved change sticks; a silent helmet is saved but not delivered', async () => {
    const id = '866652022956404'
    assert.deepEqual(await settings.fetchUnitSettings(id), { videoSplitting: true, videoSplitMinutes: 10 })
    const live = await settings.saveUnitSettings(id, { videoSplitMinutes: 20 })
    assert.equal(live.delivered, true); assert.equal(live.appliesAfterRestart, true)
    assert.deepEqual(await settings.fetchUnitSettings(id), { videoSplitting: true, videoSplitMinutes: 20 })
    assert.equal((await settings.saveUnitSettings('866652022959544', { videoSplitting: false })).delivered, false, 'offline for two days')
  })
  await t('sample network switch: no SIM is refused until forced, and the fleet then shows the new link', async () => {
    const noSim = '866652022957881'   // reports no SIM, on Wi-Fi
    const refused = await settings.switchToMobileData(noSim, false).catch((e) => e)
    assert.equal(settings.isNoSim(refused), true)
    assert.equal((await settings.switchToMobileData(noSim, true)).delivered, true)
    const after = (await fetchDevices()).find((d) => d.id === noSim)!
    assert.equal(after.telemetry.networkType, '4g'); assert.equal(after.connectivity, 'sim')
    await settings.switchToWifi(noSim); assert.equal((await fetchDevices()).find((d) => d.id === noSim)!.telemetry.networkType, 'wifi')
    assert.equal((await settings.switchToMobileData('866652022956404', false)).delivered, true, 'a helmet with a SIM needs no force')
  })

  await t('a slow start-up request gives up after the limit (and passes through its own result or error if quicker)', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200))
    await assert.rejects(withTimeout(slow, 30), (e: Error) => e instanceof TimeoutError && /30 ms/.test(e.message))
    assert.equal(await withTimeout(Promise.resolve('ok'), 500), 'ok')
    await assert.rejects(withTimeout(Promise.reject(new Error('boom')), 500), /boom/)
  })

  // ---------- sample administrators enforce the backend's rules ----------
  const signInAs = (username: string) => useAuthStore.getState().setUser(mockUserFor(username))
  await t('sample administrators: you can\'t delete yourself (400), only a super admin deletes a super admin (403)', async () => {
    signInAs('AD-001')
    const list = await admins.fetchAdmins(); const self = list.find((a) => a.username === 'AD-001')!, boss = list.find((a) => a.superAdmin)!
    await assert.rejects(admins.deleteAdmin(self.id), (e: { response?: { status: number } }) => e.response?.status === 400)
    await assert.rejects(admins.deleteAdmin(boss.id), (e: { response?: { status: number } }) => e.response?.status === 403)
    await assert.rejects(admins.updateAdmin(boss.id, { department: 'x' }), (e: { response?: { status: number } }) => e.response?.status === 403, 'nor edit one')
  })
  await t('sample administrators: you can\'t grant a code you don\'t hold (403 naming it), but may grant what you hold', async () => {
    signInAs('AD-001')
    const refused = await admins.createAdmin({ username: 'grants-too-much', password: 'secret1', permissions: ['PHOTO_RECORD_MANAGE'], deviceIds: [] }).catch((e) => e)
    assert.equal(refused.response?.status, 403); assert.equal(refused.response?.data?.permission, 'PHOTO_RECORD_MANAGE')
    const ok = await admins.createAdmin({ username: 'fine', password: 'secret1', permissions: ['MONITORING_CENTER', 'ALARM_RECORD'], deviceIds: [] }); assert.ok(ok.id > 5 && ok.superAdmin === false)
  })
  await t('sample administrators: a name can be used once (409), a short password is refused (400), and a super admin may do all of it', async () => {
    signInAs('ADM-001')
    await assert.rejects(admins.createAdmin({ username: 'op-014', password: 'secret1', permissions: ['DASHBOARD'], deviceIds: [] }), (e: { response?: { status: number } }) => e.response?.status === 409, 'case-insensitive')
    await assert.rejects(admins.createAdmin({ username: 'short-pw', password: '123', permissions: ['DASHBOARD'], deviceIds: [] }), (e: { response?: { status: number } }) => e.response?.status === 400)
    const fine = await admins.createAdmin({ username: 'anything-goes', password: 'secret1', permissions: ['PHOTO_RECORD_MANAGE'], deviceIds: [] })
    await admins.updateAdmin(fine.id, { department: 'HSE', password: '' }); assert.equal((await admins.fetchAdmins()).find((a) => a.id === fine.id)?.department, 'HSE')
    await admins.deleteAdmin(fine.id); assert.ok(!(await admins.fetchAdmins()).some((a) => a.id === fine.id))
  })
  await t('sample administrators: the last super admin can\'t be deleted (409), checked from a second super admin', async () => {
    signInAs('ADM-001')
    const second = await admins.createAdmin({ username: 'second-boss', password: 'secret1', permissions: ['DASHBOARD'], deviceIds: [] })
    // (the sample data has one super admin: confirm the rule by trying to delete them as someone else who is a super admin)
    const boss = (await admins.fetchAdmins()).find((a) => a.superAdmin)!
    useAuthStore.getState().setUser({ ...mockUserFor('ADM-001'), username: 'someone-else' })
    await assert.rejects(admins.deleteAdmin(boss.id), (e: { response?: { status: number; data?: { error?: string } } }) => e.response?.status === 409 && e.response?.data?.error === 'last_super_admin')
    await admins.deleteAdmin(second.id)
  })

  await t('sample conversations: three messages (sent, from the wearer, sent), and a new one joins the end, queued if the helmet is offline', async () => {
    const fleet = getMockFleet(), now = Date.now()
    const online = fleet.find((d) => d.active && derivePresence(d.lastSeenAt, now) !== 'offline')!, offline = fleet.find((d) => d.active && derivePresence(d.lastSeenAt, now) === 'offline')!
    const seeded = await fetchMessages(online.id); assert.deepEqual(seeded.map((m) => m.direction), ['TO_HELMET', 'FROM_HELMET', 'TO_HELMET']); assert.ok(seeded.every((m) => m.audioUrl.startsWith('data:audio/wav')))
    const audio = { uri: 'blob:fake-recording', name: 'message-1.m4a', mimeType: 'audio/mp4' }
    assert.equal((await sendVoiceMessage(online.id, audio)).delivered, true); assert.equal((await sendVoiceMessage(offline.id, audio)).delivered, false, 'offline: queued')
    const after = await fetchMessages(online.id); assert.equal(after.length, 4); assert.deepEqual([after[3].direction, after[3].audioUrl], ['TO_HELMET', 'blob:fake-recording'])
  })
}

main().then(report)
