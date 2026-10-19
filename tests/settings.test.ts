import assert from 'node:assert/strict'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import { onUnauthorized } from '@/shared/lib/unauthorized'
import {
  fetchSiteWifi, fetchUnitSettings, isNoSim, noSimMessage, removeSiteWifi, saveSiteWifi,
  saveUnitSettings, switchToMobileData, switchToWifi, toUnitSettings,
} from '@/modules/settings/api/settings.api'
import { validateSplitMinutes, validateSsid, validateWifiPassword } from '@/modules/settings/lib/validation'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const HELMET = '866652022956057'

async function main() {
  // ---------- rules ----------
  await t('a Wi-Fi name is 1-32 BYTES: accents and emoji run out sooner than ASCII', () => {
    assert.equal(validateSsid(''), 'Enter the network name.')
    assert.equal(validateSsid('E5ENERGY'), null); assert.equal(validateSsid('a'.repeat(32)), null)
    assert.match(validateSsid('a'.repeat(33)) ?? '', /at most 32/)
    assert.equal(validateSsid('é'.repeat(16)), null, '16 accented letters = 32 bytes'); assert.match(validateSsid('é'.repeat(17)) ?? '', /at most 32/)
    assert.match(validateSsid('📶'.repeat(9)) ?? '', /at most 32/, '9 emoji = 36 bytes')
  })
  await t('a Wi-Fi password is empty (keep / open network) or 8-63 characters', () => {
    assert.equal(validateWifiPassword(''), null); assert.match(validateWifiPassword('1234567') ?? '', /8 to 63/)
    assert.equal(validateWifiPassword('12345678'), null); assert.equal(validateWifiPassword('x'.repeat(63)), null); assert.match(validateWifiPassword('x'.repeat(64)) ?? '', /8 to 63/)
  })
  await t('clip length: whole minutes, 1-60 (the backend\'s own limits)', () => {
    for (const ok of [1, 10, 20, 30, 60]) assert.equal(validateSplitMinutes(ok), null, String(ok))
    for (const bad of [0, 61, 1.5, -5, NaN]) assert.ok(validateSplitMinutes(bad), String(bad))
  })
  await t('UNIT_SETTING shows Wi-Fi and unit settings; _MANAGE lets you change them', () => {
    const view = expandPermissions(['UNIT_SETTING']), manage = expandPermissions(['UNIT_SETTING_MANAGE'])
    assert.ok(view.includes('wifi:read') && view.includes('unitSettings:read')); assert.ok(!view.includes('wifi:write'))
    assert.ok(manage.includes('wifi:write') && manage.includes('unitSettings:write') && manage.includes('wifi:read'))
  })

  // ---------- site Wi-Fi (Cypher's section 6) ----------
  await t('site Wi-Fi: GET returns the name and whether a password is set (never the password); none set -> null', async () => {
    http.routes = { 'GET /settings/site-wifi': () => ({ status: 200, data: { ssid: 'E5ENERGY', passwordSet: true } }) }
    assert.deepEqual(await fetchSiteWifi(), { ssid: 'E5ENERGY', passwordSet: true })
    http.routes = { 'GET /settings/site-wifi': () => ({ status: 404 }) }; assert.equal(await fetchSiteWifi(), null, '404 = nothing set')
    http.routes = { 'GET /settings/site-wifi': () => ({ status: 200, data: {} }) }; assert.equal(await fetchSiteWifi(), null)
    http.routes = { 'GET /settings/site-wifi': () => ({ status: 500 }) }; await assert.rejects(fetchSiteWifi(), 'a server error is NOT "nothing set"')
  })
  await t('site Wi-Fi: PUT sends the password only when given, so a later edit keeps the current one', async () => {
    http.calls.length = 0
    http.routes = { 'PUT /settings/site-wifi': (r) => ({ status: 200, data: { ssid: r.data.ssid, passwordSet: true } }) }
    assert.deepEqual(await saveSiteWifi({ ssid: 'E5ENERGY', password: 'hunter2hunter2' }), { ssid: 'E5ENERGY', passwordSet: true })
    assert.deepEqual(http.calls[0].data, { ssid: 'E5ENERGY', password: 'hunter2hunter2' })
    await saveSiteWifi({ ssid: 'E5-SITE-2' }); assert.deepEqual(http.calls[1].data, { ssid: 'E5-SITE-2' })
    await saveSiteWifi({ ssid: 'E5-SITE-2', password: '' }); assert.deepEqual(http.calls[2].data, { ssid: 'E5-SITE-2' }, 'an empty password is "keep", never "blank it"')
  })
  await t('site Wi-Fi: DELETE removes it (204)', async () => {
    http.calls.length = 0; http.routes = { 'DELETE /settings/site-wifi': () => ({ status: 204 }) }
    await removeSiteWifi(); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'DELETE /settings/site-wifi')
  })

  // ---------- Unit Setting / video split (section 5) ----------
  await t('unit settings: tolerant of booleans and numbers arriving as strings', () => {
    assert.deepEqual(toUnitSettings({ videoSplitting: true, videoSplitMinutes: 2 }), { videoSplitting: true, videoSplitMinutes: 2 })
    assert.deepEqual(toUnitSettings({ videoSplitting: 'false', videoSplitMinutes: '20' }), { videoSplitting: false, videoSplitMinutes: 20 })
    assert.deepEqual(toUnitSettings({}), { videoSplitting: undefined, videoSplitMinutes: undefined }); assert.deepEqual(toUnitSettings(null), { videoSplitting: undefined, videoSplitMinutes: undefined })
  })
  await t('unit settings: GET reads the helmet\'s values', async () => {
    http.routes = { [`GET /devices/${HELMET}/settings`]: () => ({ status: 200, data: { deviceId: HELMET, uploadMethod: 'wifi', videoSplitting: true, videoSplitMinutes: 2 } }) }
    assert.deepEqual(await fetchUnitSettings(HELMET), { videoSplitting: true, videoSplitMinutes: 2 })
  })
  await t('unit settings: PUT sends only what changed, and reads back Cypher\'s documented answer', async () => {
    http.calls.length = 0
    http.routes = { [`PUT /devices/${HELMET}/settings`]: () => ({ status: 200, data: { saved: true, delivered: true, appliesAfterRestart: true, settings: { deviceId: HELMET, videoSplitting: true, videoSplitMinutes: 2 } } }) }
    const r = await saveUnitSettings(HELMET, { videoSplitting: true, videoSplitMinutes: 2 })
    assert.deepEqual(http.calls[0].data, { videoSplitting: true, videoSplitMinutes: 2 })
    assert.deepEqual(r, { saved: true, delivered: true, appliesAfterRestart: true, settings: { videoSplitting: true, videoSplitMinutes: 2 } })
    await saveUnitSettings(HELMET, { videoSplitMinutes: 20 }); assert.deepEqual(http.calls[1].data, { videoSplitMinutes: 20 }, 'a partial update must stay partial')
    http.routes = { [`PUT /devices/${HELMET}/settings`]: () => ({ status: 200, data: { saved: true, delivered: false, appliesAfterRestart: true, settings: {} } }) }
    assert.equal((await saveUnitSettings(HELMET, { videoSplitting: false })).delivered, false, 'saved but not yet delivered is its own state')
  })

  // ---------- switching network (section 7) ----------
  await t('mobile data: POST, and the helmet reports whether it received it', async () => {
    http.calls.length = 0; http.routes = { [`POST /devices/${HELMET}/network/mobile`]: () => ({ status: 200, data: { delivered: true } }) }
    assert.deepEqual(await switchToMobileData(HELMET), { delivered: true })
    assert.equal(http.calls[0].params, undefined, 'no force unless asked')
    http.routes = { [`POST /devices/${HELMET}/network/mobile`]: () => ({ status: 200, data: { delivered: false } }) }
    assert.deepEqual(await switchToMobileData(HELMET), { delivered: false })
  })
  await t('mobile data: no SIM is refused (409 no_sim) and only ?force=true overrides it', async () => {
    let unauthorized = 0; const off = onUnauthorized(() => { unauthorized++ })
    http.calls.length = 0
    http.routes = { [`POST /devices/${HELMET}/network/mobile`]: (r) => r.params?.force ? { status: 200, data: { delivered: true } } : { status: 409, data: { error: 'no_sim', message: 'The helmet has not reported a SIM card. Switching could leave it offline.' } } }
    const refused = await switchToMobileData(HELMET).catch((e) => e)
    assert.equal(isNoSim(refused), true); assert.match(noSimMessage(refused), /not reported a SIM/)
    assert.deepEqual(await switchToMobileData(HELMET, true), { delivered: true }); assert.deepEqual(http.calls[1].params, { force: true })
    assert.equal(unauthorized, 0, 'a refusal is not a dead session'); off()
  })
  await t('only the SIM refusal counts as "no SIM": other 409s and 403s are different problems', async () => {
    http.routes = { [`POST /devices/${HELMET}/network/mobile`]: () => ({ status: 409, data: { error: 'something_else' } }) }
    assert.equal(isNoSim(await switchToMobileData(HELMET).catch((e) => e)), false)
    http.routes = { [`POST /devices/${HELMET}/network/mobile`]: () => ({ status: 403, data: { error: 'forbidden', permission: 'UNIT_SETTING_MANAGE' } }) }
    assert.equal(isNoSim(await switchToMobileData(HELMET).catch((e) => e)), false)
    assert.match(noSimMessage(new Error('x')), /not reported a SIM/, 'sensible wording even with no server message')
  })
  await t('back to Wi-Fi: POST /devices/{id}/wifi/connect', async () => {
    http.calls.length = 0; http.routes = { [`POST /devices/${HELMET}/wifi/connect`]: () => ({ status: 200, data: { delivered: true } }) }
    assert.deepEqual(await switchToWifi(HELMET), { delivered: true }); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, `POST /devices/${HELMET}/wifi/connect`)
  })
}
main().then(report)
