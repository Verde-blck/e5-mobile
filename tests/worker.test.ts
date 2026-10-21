import assert from 'node:assert/strict'
import { toDevice } from '@/modules/devices/api/devices.api'
import { assignWorker, removeWorker } from '@/modules/devices/api/worker.api'
import { describeWorkerError, formFromWorker, validateWorker, workerLabel, workerPayload, wornLabel } from '@/modules/devices/lib/worker'
import { wornFromWearCode } from '@/shared/lib/api-normalize'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const base = { deviceId: '866652022956404', name: 'Test Helmet' }

async function main() {
  await t('"worn" is read from the field the backend works out: true is worn, false is not, and null (offline, or not reported) is unknown, never worn', () => {
    assert.equal(toDevice({ ...base, worn: true }).telemetry.isWorn, true); assert.equal(toDevice({ ...base, worn: false }).telemetry.isWorn, false)
    assert.equal(toDevice({ ...base, worn: null }).telemetry.isWorn, undefined); assert.equal(toDevice({ ...base }).telemetry.isWorn, undefined)
  })
  await t('the raw code is no longer read for a helmet: this app used to treat "1" as worn, which is the wrong way round', () => {
    for (const code of ['1', '2', 1, 2, 'worn']) assert.equal(toDevice({ ...base, lastWearStatus: code } as never).telemetry.isWorn, undefined, `lastWearStatus ${code} is ignored`)
    assert.equal(toDevice({ ...base, worn: false, lastWearStatus: '2' } as never).telemetry.isWorn, false, 'the field wins over the code')
  })
  await t('the history rows have no worn field, so their raw code is read by the maker\'s protocol: 2 is worn, 1 is not worn, anything else is unknown', () => {
    assert.deepEqual([2, '2', 1, '1', 0, '0', 3, null, undefined, '', 'x'].map(wornFromWearCode), [true, true, false, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined])
  })
  await t('a helmet carries the worker assigned to it, trimmed; no name means unassigned', () => {
    assert.deepEqual(toDevice({ ...base, workerName: ' John Ade ', workerStaffId: 'E5-014', workerPhone: '+2348031234567' }).worker, { name: 'John Ade', staffId: 'E5-014', phone: '+2348031234567' })
    assert.deepEqual(toDevice({ ...base, workerName: 'Ada' }).worker, { name: 'Ada', staffId: undefined, phone: undefined }, 'only the name is required')
    for (const none of [{ workerName: null }, { workerName: '' }, { workerName: '   ' }, {}]) assert.equal(toDevice({ ...base, ...none }).worker, undefined)
  })
  await t('the labels: Yes, No, a dash for unknown; the worker\'s name, or Unassigned', () => {
    assert.deepEqual([true, false, undefined].map(wornLabel), ['Yes', 'No', '–']); assert.equal(workerLabel({ name: 'John Ade' }), 'John Ade'); assert.equal(workerLabel(undefined), 'Unassigned')
  })
  await t('only the name is required, up to 80 characters; what is sent is trimmed and leaves out empty optional fields', () => {
    assert.deepEqual(validateWorker({ name: 'John Ade', staffId: '', phone: '' }), {}); assert.match(validateWorker({ name: '   ', staffId: '', phone: '' }).name ?? '', /Enter the worker/)
    assert.equal(validateWorker({ name: 'x'.repeat(80), staffId: '', phone: '' }).name, undefined); assert.match(validateWorker({ name: 'x'.repeat(81), staffId: '', phone: '' }).name ?? '', /up to 80/)
    assert.deepEqual(workerPayload({ name: ' John Ade ', staffId: ' E5-014 ', phone: '' }), { name: 'John Ade', staffId: 'E5-014' }); assert.deepEqual(workerPayload({ name: 'Ada', staffId: '', phone: '  ' }), { name: 'Ada' })
    assert.deepEqual(formFromWorker({ name: 'Ada', phone: '1' }), { name: 'Ada', staffId: '', phone: '1' }); assert.deepEqual(formFromWorker(undefined), { name: '', staffId: '', phone: '' })
  })
  await t('assigning is PUT /devices/{id}/worker with the worker, removing is DELETE, and both answer with the helmet', async () => {
    http.calls.length = 0
    http.routes = { 'PUT /devices/d1/worker': (c) => ({ status: 200, data: { deviceId: 'd1', name: 'ES5 3', workerName: (c.data as { name: string }).name, workerStaffId: (c.data as { staffId?: string }).staffId } }), 'DELETE /devices/d1/worker': () => ({ status: 200, data: { deviceId: 'd1', name: 'ES5 3', workerName: null } }) }
    const d = await assignWorker('d1', { name: 'John Ade', staffId: 'E5-014' }); assert.deepEqual(http.calls[0].data, { name: 'John Ade', staffId: 'E5-014' }); assert.equal(d.worker?.name, 'John Ade')
    const r = await removeWorker('d1'); assert.equal(`${http.calls[1].method} ${http.calls[1].url}`, 'DELETE /devices/d1/worker'); assert.equal(r.worker, undefined)
  })
  await t('a refusal says what to do: no name, no permission, no such helmet; and only a missing answer says to check the connection', () => {
    const e = (status: number, data?: unknown) => ({ response: { status, data } })
    assert.equal(describeWorkerError(e(400, { message: 'name is required' })), 'name is required'); assert.match(describeWorkerError(e(400)), /Enter the worker/); assert.match(describeWorkerError(e(403)), /isn't allowed/)
    assert.match(describeWorkerError(e(404)), /couldn't find that helmet/); assert.match(describeWorkerError(e(401)), /Sign in again/); assert.match(describeWorkerError(e(503)), /connection is fine/); assert.match(describeWorkerError({}), /Check the connection/)
  })
}
main().then(report)
