import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { TABLET_MIN_DP } from '@/shared/lib/tabletGate'
import { createRunner } from './harness'

const { t, report } = createRunner()
const plugin = createRequire(`${process.cwd()}/`)('./plugins/tabletScreens.js') as {
  MIN_WIDTH_DP: number
  setSupportsScreens: (m: { manifest: Record<string, unknown> }) => { manifest: Record<string, unknown> }
}
const attrs = (m: { manifest: Record<string, unknown> }) => (m.manifest['supports-screens'] as Array<{ $: Record<string, string> }>)[0].$

async function main() {
  await t('the Play listing is limited to tablets: no small or normal screens, large and extra large only, 600 dp across', () => {
    const a = attrs(plugin.setSupportsScreens({ manifest: { $: {}, application: [] } }))
    assert.deepEqual(a, { 'android:smallScreens': 'false', 'android:normalScreens': 'false', 'android:largeScreens': 'true', 'android:xlargeScreens': 'true', 'android:requiresSmallestWidthDp': '600' })
  })
  await t('the manifest line and the in-app check use the same width, so a tablet Play offers is never then turned away', () => {
    assert.equal(plugin.MIN_WIDTH_DP, TABLET_MIN_DP)
  })
  await t('it is set once however often it runs, and the rest of the manifest is left alone', () => {
    const m = { manifest: { $: { package: 'x' }, application: [{ marker: 1 }] } as Record<string, unknown> }
    plugin.setSupportsScreens(plugin.setSupportsScreens(m))
    assert.equal((m.manifest['supports-screens'] as unknown[]).length, 1)
    assert.deepEqual(m.manifest.$, { package: 'x' })
    assert.deepEqual(m.manifest.application, [{ marker: 1 }])
  })
}
main().then(report)
