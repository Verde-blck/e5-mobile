import assert from 'node:assert/strict'
import { MEDIUM_MIN_DP, TWO_PANE_MIN_DP, detailGoesInPane, isTwoPaneNow, listPaneWidth, navigationPosition, railItemHeight, sizeClassOf, tileWidthFor } from '@/shared/lib/layout'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  await t('breakpoints are the ones in the findings memo: 600 and 840 dp', () => {
    assert.equal(MEDIUM_MIN_DP, 600); assert.equal(TWO_PANE_MIN_DP, 840)
    assert.equal(sizeClassOf(599), 'compact'); assert.equal(sizeClassOf(600), 'medium')
    assert.equal(sizeClassOf(839), 'medium'); assert.equal(sizeClassOf(840), 'expanded')
  })
  await t('each real device and orientation lands in the right class', () => {
    const cases: Array<[string, number, string]> = [
      ['phone, portrait', 390, 'compact'],
      ['8" tablet, portrait', 600, 'medium'],
      ['10" tablet, portrait', 800, 'medium'],
      ['8" tablet, landscape', 960, 'expanded'],
      ['10" tablet, landscape', 1280, 'expanded'],
      ['tablet in split-screen (half of 1280)', 640, 'medium'],
    ]
    for (const [name, width, expected] of cases) assert.equal(sizeClassOf(width), expected, name)
  })
  await t('list/detail panes: the list column is clamped to 320-420 dp so the detail always has room', () => {
    assert.equal(listPaneWidth(600), 320); assert.equal(listPaneWidth(960), 346); assert.equal(listPaneWidth(1280), 420); assert.equal(listPaneWidth(2000), 420)
    for (const w of [840, 960, 1280]) assert.ok(w - listPaneWidth(w) >= 420, `detail pane too narrow at ${w}`)
  })
  await t('an item opens in the side pane only on a wide screen AND when the account has that tab', () => {
    assert.equal(detailGoesInPane(true, true), true)
    assert.equal(detailGoesInPane(true, false), false, 'a restricted account tapping the SOS banner must not be sent to a tab it cannot use')
    assert.equal(detailGoesInPane(false, true), false); assert.equal(detailGoesInPane(false, false), false)
  })
  await t('code outside components (banner, toast) sees the same breakpoint, from the live window width', () => {
    ;(globalThis as any).__testWidth = 1280; assert.equal(isTwoPaneNow(), true)
    ;(globalThis as any).__testWidth = 839; assert.equal(isTwoPaneNow(), false)
    ;(globalThis as any).__testWidth = 840; assert.equal(isTwoPaneNow(), true)
    ;(globalThis as any).__testWidth = 390; assert.equal(isTwoPaneNow(), false)
  })
  await t('pane selection: nothing is selected by default (auto-selecting would silently silence the top alarm)', () => {
    const s = useSelectionStore.getState(); assert.equal(s.alarmId, null); assert.equal(s.helmetId, null)
  })
  await t('selecting an alarm and a helmet are independent, and clear() resets both', () => {
    const s = useSelectionStore.getState()
    s.selectAlarm('77'); assert.equal(useSelectionStore.getState().alarmId, '77'); assert.equal(useSelectionStore.getState().helmetId, null)
    s.selectHelmet('866652022956404'); assert.equal(useSelectionStore.getState().alarmId, '77')
    s.clear(); assert.equal(useSelectionStore.getState().alarmId, null); assert.equal(useSelectionStore.getState().helmetId, null)
  })
  await t('the main navigation is a side rail on any tablet (600 dp up, portrait or landscape) and a bottom bar only on a narrow screen, where nine modules can\'t fit', () => {
    assert.equal(navigationPosition(sizeClassOf(MEDIUM_MIN_DP - 1)), 'bottom', 'a phone')
    assert.equal(navigationPosition(sizeClassOf(MEDIUM_MIN_DP)), 'left', 'an 8 inch tablet in portrait is exactly 600')
    assert.equal(navigationPosition(sizeClassOf(800)), 'left', 'a 10 inch tablet in portrait')
    assert.equal(navigationPosition(sizeClassOf(TWO_PANE_MIN_DP)), 'left', 'a tablet in landscape')
    assert.deepEqual((['compact', 'medium', 'expanded'] as const).map(navigationPosition), ['bottom', 'left', 'left'])
  })
  await t('dashboard tiles: four across when there is room, an even two by two when there is not, never three and an orphan', () => {
    assert.equal(tileWidthFor(0), undefined, 'not measured yet')
    assert.equal(tileWidthFor(568), 133, 'a 600 dp tablet without a rail: four across (568 = 4 x 133 + 3 x 12)')
    assert.equal(tileWidthFor(556), 130, 'exactly enough for four')
    assert.equal(tileWidthFor(555), 271, 'one dp short: two by two, each tile half the row')
    assert.equal(tileWidthFor(465), 226, 'a 600 dp tablet beside the rail')
    for (const w of [300, 400, 465, 555]) { const tw = tileWidthFor(w)!; assert.ok(2 * tw + 12 <= w && 3 * tw + 24 > w - 1, `${w}: two tiles fill the row, three would not fit`) }
  })
  await t('the rail squeezes its items on a short screen so More is never cut off, and leaves them alone when there is room', () => {
    assert.equal(railItemHeight(800, 10), undefined, 'a 10 inch tablet in landscape: ten at the full 70 dp (58 + 12) fit in 800')
    assert.equal(railItemHeight(960, 10), undefined, 'portrait')
    assert.equal(railItemHeight(600, 9), 51, 'an 8 inch tablet in landscape: nine boxes of 51 + 12 gap fill 600 (nine at 70 ran 30 dp off the bottom)')
    assert.equal(railItemHeight(600, 10), 45, 'ten boxes of 45')
    for (const items of [4, 6, 9, 10]) for (const h of [560, 600, 700, 800]) { const box = railItemHeight(h, items); if (box !== undefined && box > 40) assert.ok(items * (box + 12) + 28 <= h, `${items} items at ${h} dp`) }
    assert.equal(railItemHeight(300, 10), 40, 'never squeezed past what holds an icon and its label')
    assert.equal(railItemHeight(600, 0), undefined)
  })
}
main().then(report)
