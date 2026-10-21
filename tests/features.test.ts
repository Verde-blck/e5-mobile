import assert from 'node:assert/strict'
import { parseFlag } from '@/config/env'
import { featureStatuses, type FeatureInput } from '@/shared/lib/features'
import { createRunner } from './harness'

const { t, report } = createRunner()
const base: FeatureInput = { mocks: false, liveOn: true, broadcastOn: true, permissions: ['live:read', 'live:write', 'groupCall:read', 'groupCall:write'], superAdmin: false, widthDp: 800 }
const by = (input: Partial<FeatureInput>, key: string) => featureStatuses({ ...base, ...input }).find((f) => f.key === key)!

async function main() {
  await t('a switch is read the way people write it: True, TRUE, 1, yes, on, with spaces or quotes; anything else, or nothing, is off', () => {
    for (const on of ['true', 'True', 'TRUE', ' true ', '1', 'yes', 'on', '"true"', "'true'", ' "True" ']) assert.equal(parseFlag(on), true, JSON.stringify(on))
    for (const off of ['false', 'False', '0', 'no', 'off', '', ' ', 'tru', 'truee', 'enabled', undefined]) assert.equal(parseFlag(off), false, JSON.stringify(off))
  })
  await t('with the switches on and the permissions held, every feature is available', () => {
    assert.deepEqual(featureStatuses(base).map((f) => f.available), [true, true, true, true, true])
  })
  await t('a switched-off build says which switch, and how to apply it (restart with --clear, or the live profile for an APK)', () => {
    const f = by({ liveOn: false }, 'wall'); assert.equal(f.available, false); assert.match(f.reason, /EXPO_PUBLIC_LIVE_ENABLED=true/); assert.match(f.reason, /--clear/); assert.match(f.reason, /live profile/)
    assert.match(by({ broadcastOn: false }, 'send').reason, /EXPO_PUBLIC_BROADCAST_ENABLED=true/)
    assert.equal(by({ liveOn: false }, 'send').available, true, 'the two switches are independent')
    assert.equal(by({ broadcastOn: false }, 'messages').available, true, 'reading a helmet\'s messages needs no switch')
  })
  await t('a missing permission names the backend permission, so the account can be fixed where it lives', () => {
    const noLive = by({ permissions: ['groupCall:read'] }, 'wall'); assert.equal(noLive.available, false); assert.match(noLive.reason, /SURVEILLANCE/)
    assert.match(by({ permissions: ['live:read'] }, 'call').reason, /SURVEILLANCE_MANAGE/); assert.match(by({ permissions: ['live:read'] }, 'call').reason, /SOS/, 'and says SOS still works')
    assert.match(by({ permissions: ['live:read'] }, 'messages').reason, /GROUP_CALL/); assert.match(by({ permissions: ['groupCall:read'] }, 'send').reason, /GROUP_CALL/, 'reading is allowed, sending needs more')
  })
  await t('the switch is checked before the permission (nothing to grant if the build has it off)', () => {
    assert.match(by({ liveOn: false, permissions: [] }, 'wall').reason, /Switched off/)
  })
  await t('sample data mode has everything on, and a super admin holds every permission', () => {
    assert.deepEqual(featureStatuses({ ...base, mocks: true, liveOn: false, broadcastOn: false }).map((f) => f.available), [true, true, true, true, true])
    assert.deepEqual(featureStatuses({ ...base, permissions: [], superAdmin: true }).map((f) => f.available), [true, true, true, true, true])
  })
  await t('it says where to look: the side rail on a tablet, More on a narrow screen', () => {
    assert.equal(by({ widthDp: 800 }, 'wall').where, 'Live wall in the side rail'); assert.equal(by({ widthDp: 600 }, 'call').where, 'Group call in the side rail')
    assert.equal(by({ widthDp: 390 }, 'wall').where, 'More > Live wall'); assert.equal(by({ widthDp: 800 }, 'watch').where, "A helmet's own screen")
  })
}
main().then(report)
