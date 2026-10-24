import assert from 'node:assert/strict'
import { flagOr } from '@/config/env'
import { TABLET_MIN_DP, smallestSideDp, tabletGate } from '@/shared/lib/tabletGate'
import { createRunner } from './harness'

const { t, report } = createRunner()
const onAndroid = (width: number, height: number, over: object = {}) => tabletGate({ platform: 'android', enforce: true, screen: { width, height }, ...over })

async function main() {
  await t('every phone is shown the message: from a small one to the largest, in either orientation, folded or flipped', () => {
    const phones: Array<[string, number, number]> = [
      ['a small phone', 320, 568], ['Galaxy S23', 360, 780], ['Galaxy S23 Ultra', 411, 891], ['Pixel 8 Pro', 448, 998], ['a large phone at the smallest display size', 480, 1040],
      ['Galaxy Z Flip, open', 412, 915], ['Galaxy Z Fold, cover screen', 344, 882], ['a phone held sideways', 891, 411],
    ]
    for (const [name, w, h] of phones) assert.equal(onAndroid(w, h).blocked, true, name)
  })
  await t('every tablet is let in: a 7 inch, an 8 inch, a 10 inch and an 11 inch, in either orientation, and a foldable opened out', () => {
    const tablets: Array<[string, number, number]> = [
      ['a 7 inch tablet', 600, 960], ['an 8 inch tablet (Galaxy Tab A9)', 800, 1340], ['an 8 inch tablet, other density', 677, 1083], ['a 10 inch tablet', 800, 1280], ['an 11 inch tablet', 840, 1340],
      ['a tablet held sideways', 1280, 800], ['Galaxy Z Fold, opened out', 673, 841], ['a 12 inch tablet', 1024, 1600],
    ]
    for (const [name, w, h] of tablets) assert.equal(onAndroid(w, h).blocked, false, name)
  })
  await t('the line is 600 dp on the smaller side: 599 is a phone, 600 is a tablet, and turning the screen changes nothing', () => {
    assert.equal(TABLET_MIN_DP, 600); assert.equal(onAndroid(599, 1200).blocked, true); assert.equal(onAndroid(600, 1200).blocked, false); assert.equal(onAndroid(1200, 599).blocked, true); assert.equal(onAndroid(1200, 600).blocked, false)
    assert.deepEqual([onAndroid(390, 844), onAndroid(844, 390)].map((r) => r.smallestDp), [390, 390], 'the same measurement whichever way it is held')
  })
  await t('the measurement is the smaller side, rounded to whole dp, and 0 if the screen has no size', () => {
    assert.equal(smallestSideDp({ width: 411.4, height: 891.4 }), 411); assert.equal(smallestSideDp({ width: 800, height: 1280 }), 800)
    for (const bad of [[0, 0], [0, 800], [800, 0], [-1, 800], [NaN, 800], [800, NaN], [Infinity, 0]] as Array<[number, number]>) assert.equal(smallestSideDp({ width: bad[0], height: bad[1] }), bad[0] > 0 && bad[1] > 0 && Number.isFinite(bad[0]) && Number.isFinite(bad[1]) ? Math.min(bad[0], bad[1]) : 0, `${bad}`)
  })
  await t('a screen that cannot be measured is never blocked: the gate must not lock a real tablet out on a guess', () => {
    for (const [w, h] of [[0, 0], [NaN, NaN], [0, 1200], [-5, -5]] as Array<[number, number]>) assert.equal(onAndroid(w, h).blocked, false, `${w}x${h}`)
  })
  await t('it applies on Android only: the browser preview and iOS are never blocked, and the setting turns it off', () => {
    assert.equal(tabletGate({ platform: 'web', enforce: true, screen: { width: 390, height: 844 } }).blocked, false, 'the browser preview is a development tool')
    assert.equal(tabletGate({ platform: 'ios', enforce: true, screen: { width: 390, height: 844 } }).blocked, false)
    assert.equal(onAndroid(390, 844, { enforce: false }).blocked, false, 'EXPO_PUBLIC_TABLET_ONLY=false lets a phone use the app, for testing')
  })
  await t('it can be forced on anywhere, so it can be tested in a browser, and forcing it still lets tablets through', () => {
    assert.equal(tabletGate({ platform: 'web', enforce: false, forced: true, screen: { width: 390, height: 844 } }).blocked, true)
    assert.equal(tabletGate({ platform: 'web', enforce: false, forced: true, screen: { width: 800, height: 1280 } }).blocked, false)
    assert.equal(tabletGate({ platform: 'web', enforce: true, forced: false, screen: { width: 390, height: 844 } }).blocked, false, 'forced: false is not forced')
  })
  await t('the setting is ON unless it says it is off: unset, empty or anything but false, 0, no or off keeps phones out', () => {
    for (const on of [undefined, '', '  ', 'true', 'True', '1', 'yes', 'on', 'anything']) assert.equal(flagOr(on, true), true, String(on))
    for (const off of ['false', 'False', 'FALSE', '0', 'no', 'off', ' false ', '"false"', "'off'"]) assert.equal(flagOr(off, true), false, off)
    assert.equal(flagOr(undefined, false), false, 'and the fallback is the fallback')
  })
}
main().then(report)
