import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRunner } from './harness'

const { t, report } = createRunner()
const script = join(process.cwd(), 'scripts', 'prune-stale.mjs')

function project(extras: string[], manifest: 'good' | 'none' | 'tiny' = 'good') {
  const root = mkdtempSync(join(tmpdir(), 'e5-prune-'))
  const put = (file: string) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), 'x') }
  const keep = [...Array.from({ length: 8 }, (_, i) => `src/modules/m${i}/keep.ts`), 'docs/README.md', 'tests/keep.test.ts']
  keep.forEach(put); extras.forEach(put)
  ;['package.json', '.env', 'e5.local.json', 'assets/user-logo.png', 'node_modules/pkg/index.js', 'App.tsx'].forEach(put)
  if (manifest === 'good') writeFileSync(join(root, 'zip-manifest.txt'), keep.join('\n') + '\n')
  if (manifest === 'tiny') writeFileSync(join(root, 'zip-manifest.txt'), 'src/a.ts\n')
  return { root, keep }
}
const run = (root: string, ...args: string[]) => spawnSync(process.execPath, [script, '--root', root, ...args], { encoding: 'utf8' })
const left = (root: string, file: string) => existsSync(join(root, file))

async function main() {
  await t('by default it only LISTS the files that no longer belong, and deletes nothing', () => {
    const { root } = project(['src/app/admins.tsx', 'src/modules/calls/lib/engine.ts', 'docs/old-notes.md'])
    const out = run(root); assert.equal(out.status, 0)
    for (const stale of ['src/app/admins.tsx', 'src/modules/calls/lib/engine.ts', 'docs/old-notes.md']) { assert.match(out.stdout, new RegExp(stale.replace(/[./]/g, '\\$&'))); assert.ok(left(root, stale), `${stale} is still there`) }
    assert.match(out.stdout, /3 files no longer belong/); assert.match(out.stdout, /Nothing was deleted/); rmSync(root, { recursive: true })
  })
  await t('with --apply it deletes exactly those, and the files that belong are all still there', () => {
    const { root, keep } = project(['src/app/track.tsx', 'src/app/(tabs)/wifi.tsx'])
    const out = run(root, '--apply'); assert.equal(out.status, 0); assert.match(out.stdout, /Deleted 2/)
    assert.ok(!left(root, 'src/app/track.tsx') && !left(root, 'src/app/(tabs)/wifi.tsx')); for (const k of keep) assert.ok(left(root, k), `${k} was kept`); rmSync(root, { recursive: true })
  })
  await t('it never touches anything outside src, tests and docs: .env, e5.local.json, assets, node_modules, package.json and App.tsx are safe', () => {
    const { root } = project(['src/stale.ts']); run(root, '--apply')
    for (const safe of ['package.json', '.env', 'e5.local.json', 'assets/user-logo.png', 'node_modules/pkg/index.js', 'App.tsx', 'zip-manifest.txt']) assert.ok(left(root, safe), `${safe} is still there`); rmSync(root, { recursive: true })
  })
  await t('a folder left empty by the deletions is removed too, while one that still has files is not', () => {
    const { root } = project(['src/old-module/a.ts', 'src/old-module/deep/b.ts']); run(root, '--apply')
    assert.ok(!left(root, 'src/old-module'), 'the emptied folder is gone'); assert.ok(left(root, 'src/modules/m0'), 'a folder that still has files stays'); rmSync(root, { recursive: true })
  })
  await t('when nothing is left over it says so, and a second run after deleting finds nothing', () => {
    const clean = project([]); assert.match(run(clean.root).stdout, /No leftover files/); rmSync(clean.root, { recursive: true })
    const { root } = project(['src/x.ts']); run(root, '--apply'); assert.match(run(root).stdout, /No leftover files/); rmSync(root, { recursive: true })
  })
  await t('with no manifest, or one that looks damaged, it refuses and deletes nothing (acting on it would delete real files)', () => {
    for (const manifest of ['none', 'tiny'] as const) {
      const { root } = project(['src/stale.ts', 'src/modules/m0/keep.ts'], manifest); const out = run(root, '--apply')
      assert.notEqual(out.status, 0, manifest); assert.ok(left(root, 'src/stale.ts') && left(root, 'src/modules/m0/keep.ts'), `${manifest}: nothing was deleted`); rmSync(root, { recursive: true })
    }
  })
  await t('paths are compared with forward slashes, so a manifest made anywhere matches the folder on Windows too', () => {
    const { root } = project(['src/app/(tabs)/x.tsx']); const out = execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8' }); assert.match(out, /src\/app\/\(tabs\)\/x\.tsx/); assert.ok(!/\\/.test(out.split('\n').filter((l) => l.startsWith('  '))[0] ?? ''), 'no backslashes'); rmSync(root, { recursive: true }); void readdirSync
  })
}
main().then(report)
