import assert from 'node:assert/strict'
import { getMockGasStatus } from '@/modules/devices/api/devices.mock'
import { gasAgeLabel, gasFreshness } from '@/modules/devices/lib/gasStatus'
import { parseGasStatus } from '@/shared/lib/api-normalize'
import { createRunner } from './harness'

const { t, report } = createRunner()
const NOW = 1_700_000_000_000

async function main() {
  await t('the three liveness fields are read from the gas response, as the server sends them', () => {
    assert.deepEqual(parseGasStatus({ online: true, ageSeconds: 12, live: true }), { online: true, ageSeconds: 12, live: true })
    assert.deepEqual(parseGasStatus({ online: false, ageSeconds: 540, live: false }), { online: false, ageSeconds: 540, live: false })
  })
  await t('text and 1/0 versions of a boolean are understood, and a number sent as text is a number', () => {
    assert.deepEqual(parseGasStatus({ online: 'true', live: 'false', ageSeconds: '300' }), { online: true, live: false, ageSeconds: 300 })
    assert.deepEqual(parseGasStatus({ online: 1, live: 0 }), { online: true, live: false, ageSeconds: undefined })
  })
  await t('a missing or odd value stays unknown: it is never turned into false, which would claim a helmet is offline', () => {
    assert.deepEqual(parseGasStatus({ live: 'maybe', online: null, ageSeconds: 'soon' }), undefined)
    assert.deepEqual(parseGasStatus({ ageSeconds: 30 }), { online: undefined, ageSeconds: 30, live: undefined })
    for (const nothing of [undefined, null, '', 'live', 5, true, [], {}]) assert.equal(parseGasStatus(nothing), undefined, String(nothing))
  })
  await t('a negative age is not believed', () => {
    assert.equal(parseGasStatus({ live: true, ageSeconds: -5 })?.ageSeconds, undefined)
    assert.equal(parseGasStatus({ live: true, ageSeconds: 0 })?.ageSeconds, 0)
  })

  await t('ages are worded in the right unit, with the boundaries in the right place', () => {
    const cases: Array<[number, string]> = [
      [0, 'less than a minute ago'], [59, 'less than a minute ago'], [59.9, 'less than a minute ago'], [60, '1 min ago'], [119, '1 min ago'], [125, '2 min ago'],
      [300, '5 min ago'], [3599, '59 min ago'], [3600, '1 h ago'], [7300, '2 h ago'], [86_399, '23 h ago'], [86_400, '1 d ago'], [3 * 86_400 + 5, '3 d ago'], [-30, 'less than a minute ago'],
    ]
    for (const [seconds, words] of cases) assert.equal(gasAgeLabel(seconds), words, `${seconds}`)
  })

  await t('a reading the server says is not live is shown as offline, with the exact wording asked for', () => {
    const f = gasFreshness({ live: false, ageSeconds: 300 }, NOW - 1000, NOW)
    assert.equal(f.offline, true)
    assert.equal(f.label, 'Offline \u2013 last reading 5 min ago')
  })
  await t('the server\'s age is used when it sends one, so a tablet with the wrong clock cannot misreport it', () => {
    assert.equal(gasFreshness({ live: false, ageSeconds: 600 }, NOW - 5_000, NOW).label, 'Offline \u2013 last reading 10 min ago')
  })
  await t('without the server\'s age, the time of the reading is used; without either, it says the time is unknown', () => {
    assert.equal(gasFreshness({ live: false }, NOW - 7 * 60_000, NOW).label, 'Offline \u2013 last reading 7 min ago')
    assert.equal(gasFreshness({ live: false }, undefined, NOW).label, 'Offline \u2013 time of last reading unknown')
  })
  await t('only live === false means offline: live, unknown and a failed request all leave the reading as current', () => {
    for (const status of [{ live: true, ageSeconds: 10 }, { online: false, ageSeconds: 900 }, { ageSeconds: 900 }, {}, undefined]) {
      const f = gasFreshness(status, NOW - 900_000, NOW)
      assert.deepEqual(f, { offline: false, label: null }, JSON.stringify(status))
    }
  })

  await t('the sample fleet has one live helmet and one whose gas reading is old', () => {
    const live = getMockGasStatus('866652022956404')
    assert.equal(live?.live, true); assert.ok((live?.ageSeconds ?? 999) < 60)
    const stale = getMockGasStatus('866652022958277')
    assert.equal(stale?.live, false); assert.equal(stale?.online, false); assert.ok((stale?.ageSeconds ?? 0) >= 530)
    assert.equal(getMockGasStatus('866652022958103'), undefined, 'a helmet with no gas sensor has no status')
  })
}
main().then(report)
