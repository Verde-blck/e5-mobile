// `npm test` — logic tests for the pieces that don't need a phone: token
// storage, the sign-in / 2FA request shapes, 401 handling, API normalising,
// roles, presence rules, the alarm vocabulary, footage, the alert policy, the tablet layout rules and the map.
//
// Each suite is bundled with esbuild (so the app's `@/` imports and the
// TypeScript just work) with the two native modules stubbed out, then run in
// a plain Node process. HTTP is mocked at the axios adapter, so nothing here
// touches the network.
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const suites = [
  ['live', {}], // mocks off: exercises the real request code paths
  ['stream', {}], // the alarm stream client against a fake streaming server
  ['layout', {}], // screen-size classes and the list/detail pane rules
  ['map', {}], // map data rules, the embedded map page, and events from it
  ['settings', {}], // site Wi-Fi, helmet settings and network switching against Cypher's documented requests
  ['fences', {}], // fence API shapes, geometry and validation (ported from the web app)
  ['users', {}], // administrators: grant rules, permission tree, who may edit or delete whom, endpoints
  ['build', {}], // the generated style sheet is sound (a stray pattern in source can break the NATIVE build only)
  ['calls', {}], // call access rule (SOS window), state machine, engines
  ['push', {}], // alarm push: payloads, channels, registration contract, permission flow, build config
  ['track', { TZ: 'Africa/Lagos' }], // track rules (gaps, jumps, noise), availability and dates, in Lagos time
  ['mock', { EXPO_PUBLIC_USE_MOCKS: 'true' }], // sample-data mode
]

let failed = false
for (const [name, env] of suites) {
  const outfile = path.join(root, '.test-out', `${name}.cjs`)
  await build({
    entryPoints: [path.join(root, 'tests', `${name}.test.ts`)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'warning',
    // The sample-data alarms bundle a photo and a clip; the tests only need them to resolve.
    loader: { '.jpg': 'dataurl', '.mp4': 'dataurl', '.wav': 'dataurl' },
    tsconfig: path.join(root, 'tsconfig.json'),
    alias: {
      '@': path.join(root, 'src'),
      'react-native': path.join(root, 'tests/stubs/react-native.ts'),
      'expo-secure-store': path.join(root, 'tests/stubs/expo-secure-store.ts'),
      'expo-asset': path.join(root, 'tests/stubs/expo-asset.ts'),
    },
  })
  console.log(`\n== ${name} suite ==`)
  const run = spawnSync(process.execPath, [outfile], {
    stdio: 'inherit',
    env: { ...process.env, ...env, NODE_PATH: path.join(root, 'node_modules') },
  })
  if (run.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
