import assert from 'node:assert/strict'
import { PERMISSION_TREE, allPermissionCodes, type ApiPermission, type PermissionNode } from '@/shared/constants/backend-permissions'
import { createAdmin, deleteAdmin, fetchAdmins, fetchPermissions, updateAdmin, createGroup, renameGroup, deleteGroup, fetchGroups } from '@/modules/users/api/admins.api'
import { canGrant, countAreas, flattenTree, rowState, selectAll, toggleManage, toggleView } from '@/modules/users/lib/permissionTree'
import { deleteErrorMessage, describeAccess, groupLabel, rowRules, saveErrorMessage, validateAdmin } from '@/modules/users/lib/rules'
import type { Administrator } from '@/modules/users/types'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const node = (code: string): PermissionNode => flattenTree().map((f) => f.node).find((n) => n.code === code)!
const admin = (over: Partial<Administrator> = {}): Administrator => ({ id: 1, username: 'x', permissions: [], deviceIds: [], ...over })
const sorted = (a: readonly string[]) => [...a].sort()

async function main() {
  await t('you can only grant a code you hold (a super admin, anything); holding X_MANAGE includes X', () => {
    assert.equal(canGrant(null, 'FENCE'), true)
    const mine = new Set(['FENCE_MANAGE', 'DASHBOARD'])
    assert.equal(canGrant(mine, 'FENCE_MANAGE'), true); assert.equal(canGrant(mine, 'FENCE'), true, 'view is included in manage'); assert.equal(canGrant(mine, 'DASHBOARD'), true)
    assert.equal(canGrant(mine, 'ALARM_RECORD'), false); assert.equal(canGrant(new Set(['FENCE']), 'FENCE_MANAGE'), false, 'view alone cannot grant manage')
  })
  await t('a row says what to show: heading, hidden when the backend doesn\'t offer it, the change box only where it exists and is offered', () => {
    const all = allPermissionCodes()
    assert.equal(rowState(PERMISSION_TREE.find((n) => n.label === 'Set')!, [], all, null).heading, true)
    const fence = rowState(node('FENCE'), ['FENCE_MANAGE'], all, null); assert.deepEqual([fence.viewing, fence.managing, fence.manage], [true, true, 'FENCE_MANAGE'])
    assert.equal(rowState(node('DASHBOARD'), ['DASHBOARD'], all, null).manage, undefined, 'a single-code area has no change box')
    assert.equal(rowState(node('FENCE'), [], all.filter((c) => c !== 'FENCE'), null).hidden, true, 'not offered: hidden')
    assert.equal(rowState(node('FENCE'), [], all.filter((c) => c !== 'FENCE_MANAGE'), null).manage, undefined, 'the change code isn\'t offered')
    const limited = rowState(node('FENCE'), [], all, new Set(['FENCE'])); assert.deepEqual([limited.viewAllowed, limited.manageAllowed], [true, false])
  })
  await t('ticking View grants the plain code; unticking removes view AND change', () => {
    const fence = node('FENCE')
    assert.deepEqual(toggleView([], fence), ['FENCE']); assert.deepEqual(toggleView(['FENCE'], fence), []); assert.deepEqual(toggleView(['FENCE_MANAGE'], fence), [], 'removing view removes manage too')
    assert.deepEqual(toggleView(['DASHBOARD'], fence).sort(), ['DASHBOARD', 'FENCE'], 'other areas untouched')
  })
  await t('Can change swaps view for manage (only one is ever stored), and back', () => {
    const fence = node('FENCE')
    assert.deepEqual(toggleManage(['FENCE'], fence), ['FENCE_MANAGE']); assert.deepEqual(toggleManage(['FENCE_MANAGE'], fence), ['FENCE'], 'back to view only')
    assert.deepEqual(toggleManage([], fence), ['FENCE_MANAGE'], 'changing implies viewing')
    assert.deepEqual(toggleManage(['DASHBOARD'], node('DASHBOARD')), ['DASHBOARD'], 'no change code: nothing to do')
  })
  await t('Select all takes the strongest code per area, within what is offered and what you may grant', () => {
    const everything = selectAll(allPermissionCodes(), null)
    assert.ok(everything.includes('FENCE_MANAGE') && !everything.includes('FENCE') && everything.includes('DASHBOARD'), 'strongest per area')
    assert.equal(everything.length, new Set(everything.map((c) => c.replace(/_MANAGE$/, ''))).size, 'one code per area')
    assert.deepEqual(sorted(selectAll(allPermissionCodes(), new Set(['DASHBOARD', 'FENCE']))), ['DASHBOARD', 'FENCE'], 'only what you hold, at the level you hold it')
    assert.deepEqual(selectAll(['DASHBOARD'] as ApiPermission[], null), ['DASHBOARD'], 'only what the backend offers')
  })
  await t('areas are counted once whether held as view or manage', () => {
    assert.equal(countAreas([]), 0); assert.equal(countAreas(['FENCE_MANAGE', 'FENCE', 'DASHBOARD']), 2)
  })

  await t('only a super admin touches a super admin; nobody deletes themselves', () => {
    const boss = admin({ username: 'boss', superAdmin: true }), staff = admin({ username: 'staff' })
    assert.deepEqual(rowRules(boss, { username: 'staff', superAdmin: false }), { lockedSuper: true, isSelf: false, canEdit: false, canDelete: false })
    assert.deepEqual(rowRules(boss, { username: 'other', superAdmin: true }), { lockedSuper: false, isSelf: false, canEdit: true, canDelete: true })
    assert.deepEqual(rowRules(staff, { username: 'staff', superAdmin: false }), { lockedSuper: false, isSelf: true, canEdit: true, canDelete: false }, 'you can edit yourself, not delete yourself')
    assert.deepEqual(rowRules(boss, { username: 'boss', superAdmin: true }), { lockedSuper: false, isSelf: true, canEdit: true, canDelete: false })
    assert.equal(rowRules(staff, null).canDelete, true)
  })
  await t('how an account\'s access reads, and a deleted group says so rather than showing a blank', () => {
    assert.equal(describeAccess(admin({ superAdmin: true })), 'Everything'); assert.equal(describeAccess(admin({ permissions: ['FENCE_MANAGE', 'FENCE', 'DASHBOARD'], deviceIds: [] })), '2 areas · all helmets')
    assert.equal(describeAccess(admin({ permissions: ['DASHBOARD'], deviceIds: ['1'] })), '1 area · 1 helmet'); assert.equal(describeAccess(admin({ permissions: ['DASHBOARD'], deviceIds: ['1', '2'] })), '1 area · 2 helmets')
    const groups = [{ id: 1, name: 'Head office' }]
    assert.deepEqual(groupLabel(1, groups), { text: 'Head office', missing: false }); assert.deepEqual(groupLabel(null, groups), { text: 'No group', missing: false }); assert.deepEqual(groupLabel(99, groups), { text: 'Missing group (99)', missing: true })
  })
  await t('what stops a save, in the order to fix it', () => {
    const ok = { username: 'abc', password: 'secret1', permissions: ['DASHBOARD'] }
    assert.equal(validateAdmin(ok, false), null); assert.equal(validateAdmin({ ...ok, username: ' a ' }, false), 'Account name is required.')
    assert.match(validateAdmin({ ...ok, password: '12345' }, false) ?? '', /at least 6/); assert.equal(validateAdmin({ ...ok, password: '' }, true), null, 'editing: blank password means leave it')
    assert.match(validateAdmin({ ...ok, password: '123' }, true) ?? '', /new password/i); assert.equal(validateAdmin({ ...ok, permissions: [] }, false), 'Select at least one permission.')
  })
  await t('refusals in words: you can\'t grant what you don\'t hold, super admins only, name taken, deletes refused for the three reasons', () => {
    const http = (status: number, data: object = {}) => ({ response: { status, data } })
    assert.match(saveErrorMessage(http(403, { permission: 'ALARM_RECORD_MANAGE' }), false), /can't grant alarm record manage: you don't hold it/); assert.match(saveErrorMessage(http(403, {}), true), /Only a super admin/)
    assert.match(saveErrorMessage(http(409), false), /already in use/); assert.equal(saveErrorMessage(http(400, { message: 'Too short' }), false), 'Not saved: Too short.')
    assert.match(saveErrorMessage(new Error('Network Error'), true), /Could not save/); assert.match(saveErrorMessage(new Error('x'), false), /Could not create/)
    assert.match(deleteErrorMessage(http(400)), /own account/); assert.match(deleteErrorMessage(http(403)), /super admin can delete a super admin/); assert.match(deleteErrorMessage(http(409, { error: 'last_super_admin' })), /last super admin/); assert.match(deleteErrorMessage(http(500)), /Couldn't delete/)
  })

  await t('list, create, update and delete hit the backend\'s paths; a blank password is never sent on an edit', async () => {
    http.calls.length = 0
    http.routes = { 'GET /admins': () => ({ status: 200, data: [{ id: 1, username: 'a', permissions: [], deviceIds: [] }] }), 'POST /admins': (r) => ({ status: 200, data: { id: 9, ...r.data } }), 'PUT /admins/9': (r) => ({ status: 200, data: { id: 9, ...r.data } }), 'DELETE /admins/9': () => ({ status: 204 }) }
    assert.equal((await fetchAdmins()).length, 1)
    const input = { username: 'new', password: 'secret1', permissions: ['DASHBOARD'] as ApiPermission[], deviceIds: [] }
    await createAdmin(input); assert.deepEqual(http.calls[1].data, input)
    await updateAdmin(9, { username: 'new', password: '', department: 'HSE' }); assert.ok(!('password' in (http.calls[2].data as object)), 'a blank password is left out entirely')
    await updateAdmin(9, { password: 'brandnew1' }); assert.equal((http.calls[3].data as { password: string }).password, 'brandnew1')
    await deleteAdmin(9); assert.equal(`${http.calls[4].method} ${http.calls[4].url}`, 'DELETE /admins/9')
  })
  await t('the permission catalogue comes from the backend, with the local list as the fallback', async () => {
    http.routes = { 'GET /permissions': () => ({ status: 200, data: ['DASHBOARD', 'FENCE'] }) }; assert.deepEqual(await fetchPermissions(), ['DASHBOARD', 'FENCE'])
    http.routes = { 'GET /permissions': () => ({ status: 200, data: [] }) }; assert.deepEqual(await fetchPermissions(), allPermissionCodes())
    http.routes = { 'GET /permissions': () => ({ status: 500 }) }; assert.deepEqual(await fetchPermissions(), allPermissionCodes(), 'a failed request falls back rather than hiding the form')
  })
  await t('groups: list, create, rename, delete', async () => {
    http.calls.length = 0
    http.routes = { 'GET /groups': () => ({ status: 200, data: [{ id: 1, name: 'A' }] }), 'POST /groups': (r) => ({ status: 200, data: { id: 2, ...r.data } }), 'PUT /groups/2': (r) => ({ status: 200, data: { id: 2, ...r.data } }), 'DELETE /groups/2': () => ({ status: 204 }) }
    assert.equal((await fetchGroups()).length, 1); assert.deepEqual((await createGroup('Rig crew')).name, 'Rig crew'); assert.deepEqual(http.calls[1].data, { name: 'Rig crew' })
    await renameGroup(2, 'Night shift'); assert.deepEqual(http.calls[2].data, { name: 'Night shift' }); await deleteGroup(2); assert.equal(`${http.calls[3].method} ${http.calls[3].url}`, 'DELETE /groups/2')
  })
}
main().then(report)
