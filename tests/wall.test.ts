import assert from 'node:assert/strict'
import { HelmetSession, type SessionDeps } from '@/modules/live/lib/session'
import { NotReadyError, type MediaConnection } from '@/modules/live/lib/signalling'
import { WALL_MAX, WallSessions, toggleSelection, wallColumns } from '@/modules/live/lib/wall'
import type { StreamLike } from '@/modules/live/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const until = async (cond: () => boolean, ms = 1500) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(5); assert.ok(cond(), 'timed out waiting') }
const stream = (): StreamLike => ({ getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] })

function wall(broken: string[] = []) {
  const log: string[] = []; const background: Array<(b: boolean) => void> = []; let appWatcher: ((b: boolean) => void) | null = null
  const deps = (id: string): SessionDeps => ({
    startCall: async () => { throw new Error('a wall never calls') },
    startLive: async (d) => { log.push(`start:${d}`); return { delivered: true, watchUrl: 'w' } },
    stopCall: async () => {},
    getLocalMedia: async () => ({ stream: stream(), noCamera: false }),
    play: async (): Promise<MediaConnection> => { if (broken.includes(id)) throw new NotReadyError('no picture'); return { stream: stream(), close: () => {}, onLost: () => {} } },
    push: async () => { throw new Error('never') },
    watchBackground: (cb) => { background.push(cb); return () => {} },
    timing: { intervalMs: 5, deadlineMs: 40, leaveGraceMs: 30 },
  })
  const sessions = new WallSessions((id) => new HelmetSession(id, 'watch', deps(id)), (cb) => { appWatcher = cb; return () => { appWatcher = null } })
  sessions.attach()
  return { sessions, log, goBackground: (b: boolean) => { background.forEach((cb) => cb(b)); appWatcher?.(b) } }
}
const status = (w: WallSessions, id: string) => w.get(id)?.getState().status

async function main() {
  await t('who can be on the wall: anyone active, up to six; a deactivated helmet and a seventh are refused; removing is always allowed', () => {
    const a = (id: string, active = true) => ({ id, active })
    assert.deepEqual(toggleSelection([], a('1')).selected, ['1']); assert.deepEqual(toggleSelection(['1'], a('2')).selected, ['1', '2'], 'in the order chosen')
    assert.deepEqual(toggleSelection(['1', '2'], a('1')).selected, ['2'], 'choosing one that is on takes it off')
    const six = ['1', '2', '3', '4', '5', '6']; assert.equal(WALL_MAX, 6)
    const seventh = toggleSelection(six, a('7')); assert.deepEqual([seventh.selected, seventh.blocked], [six, 'full'])
    assert.deepEqual(toggleSelection(six, a('3')).selected, ['1', '2', '4', '5', '6'], 'a full wall can still lose one')
    const off = toggleSelection(['1'], a('9', false)); assert.deepEqual([off.selected, off.blocked], [['1'], 'deactivated'])
    assert.equal(toggleSelection(['9'], a('9', false)).selected.length, 0, 'a helmet deactivated since it was added can still be removed')
  })
  await t('the grid is one column when narrow, two by default, three on a wide tablet', () => {
    assert.deepEqual([300, 419, 420, 700, 899, 900, 1280].map(wallColumns), [1, 1, 2, 2, 2, 3, 3])
  })
  await t('starting a helmet connects it as a watch session; starting it again replaces the connection rather than doubling it', async () => {
    const { sessions, log } = wall(); sessions.start('a'); await until(() => status(sessions, 'a') === 'live'); const first = sessions.get('a')!
    assert.equal(sessions.running, 1); sessions.start('a'); assert.equal(first.getState().status, 'ended', 'the old connection was closed'); assert.notEqual(sessions.get('a'), first); await until(() => status(sessions, 'a') === 'live')
    assert.equal(sessions.running, 1, 'still one helmet'); assert.deepEqual(log, ['start:a', 'start:a']); sessions.dispose()
  })
  await t('every tile is its own session: one helmet with no picture never affects the others', async () => {
    const { sessions } = wall(['bad']); ['a', 'bad', 'c'].forEach((id) => sessions.start(id))
    await until(() => status(sessions, 'a') === 'live' && status(sessions, 'c') === 'live' && status(sessions, 'bad') === 'failed')
    assert.equal(sessions.running, 3, 'a failed tile is still on the wall (it can be retried)'); sessions.get('bad')!.end(); assert.equal(status(sessions, 'a'), 'live'); sessions.dispose()
  })
  await t('removing a helmet disconnects just that one; "stop all" disconnects every one', async () => {
    const { sessions } = wall(); ['a', 'b', 'c'].forEach((id) => sessions.start(id)); await until(() => sessions.running === 3 && ['a', 'b', 'c'].every((id) => status(sessions, id) === 'live'))
    const b = sessions.get('b')!; sessions.stop('b'); assert.equal(b.getState().status, 'ended'); assert.equal(sessions.get('b'), null); assert.equal(sessions.running, 2); assert.equal(status(sessions, 'a'), 'live')
    sessions.stopAll(); assert.equal(sessions.running, 0); assert.equal(sessions.get('a'), null)
  })
  await t('leaving the wall disconnects everything and coming back reconnects exactly the helmets that were on (not ones that were stopped)', async () => {
    const { sessions, log } = wall(); ['a', 'b', 'c'].forEach((id) => sessions.start(id)); await until(() => sessions.running === 3 && status(sessions, 'c') === 'live'); sessions.stop('c')
    const a = sessions.get('a')!; sessions.suspend(); assert.equal(a.getState().status, 'ended'); assert.equal(sessions.running, 0, 'no streams while you are elsewhere (they cost the helmets\' mobile data)')
    log.length = 0; sessions.resume(); await until(() => status(sessions, 'a') === 'live' && status(sessions, 'b') === 'live'); assert.deepEqual([...log].sort(), ['start:a', 'start:b'], 'a and b are back; the stopped c is not')
    sessions.resume(); assert.equal(log.length, 2, 'resuming twice does not start them twice'); sessions.dispose()
  })
  await t('a tablet cannot stream from the background: sessions that ended because the app was left are started again when it returns', async () => {
    const { sessions, goBackground } = wall(); ['a', 'b'].forEach((id) => sessions.start(id)); await until(() => status(sessions, 'a') === 'live' && status(sessions, 'b') === 'live'); sessions.stop('b'); sessions.start('b'); await until(() => status(sessions, 'b') === 'live')
    const before = sessions.get('a')!; goBackground(true); await until(() => before.getState().status === 'ended'); assert.equal(before.getState().endReason, 'left-app')
    goBackground(false); await until(() => status(sessions, 'a') === 'live' && sessions.get('a') !== before); assert.equal(sessions.running, 2, 'both are back on the wall'); sessions.dispose()
  })
  await t('a helmet the operator stopped is not revived when the app comes back', async () => {
    const { sessions, goBackground } = wall(); sessions.start('a'); sessions.start('b'); await until(() => status(sessions, 'a') === 'live' && status(sessions, 'b') === 'live'); sessions.stop('b')
    goBackground(true); await sleep(80); goBackground(false); await sleep(60); assert.equal(sessions.get('b'), null); sessions.dispose()
  })
  await t('the wall can be watched for changes (so the screen redraws), and disposing releases everything', async () => {
    const { sessions } = wall(); let calls = 0; const off = sessions.subscribe(() => { calls += 1 }); const v = sessions.getVersion()
    sessions.start('a'); sessions.stop('a'); assert.ok(calls >= 2 && sessions.getVersion() > v); off(); const n = calls; sessions.start('b'); assert.equal(calls, n, 'unsubscribed'); const b = sessions.get('b')!; sessions.dispose(); assert.equal(b.getState().status, 'ended')
  })
  await t('after being disposed (React remounting a screen) the same wall can be attached again and still reacts to the app returning', async () => {
    const { sessions, goBackground } = wall(); sessions.dispose(); sessions.attach(); sessions.start('a'); await until(() => status(sessions, 'a') === 'live')
    const before = sessions.get('a')!; goBackground(true); await until(() => before.getState().status === 'ended'); goBackground(false); await until(() => status(sessions, 'a') === 'live' && sessions.get('a') !== before); sessions.dispose()
  })
}
main().then(report)
