// Each suite is bundled with esbuild (so the app's `@/` imports and TypeScript just work) with the two native modules
// stubbed out, then run in plain Node. HTTP is mocked at the axios adapter, so nothing touches the network.
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const suites = [
  ['live', {}],
  ['stream', {}],
  ['groupsession', {}],
  ['audio', {}],
  ['wall', {}],
  ['twofactor', {}],
  ['worker', {}],
  ['branding', {}],
  ['media', {}],
  ['tabletscreens', {}], // the tablet-only declaration for Google Play
  ['tabletgate', {}],
  ['nativemap', {}],
  ['mapkey', {}],
  ['plexus', {}],
  ['prune', {}],
  ['flags', {}],
  ['layout', {}],
  ['map', {}],
  ['settings', {}],
  ['fences', {}],
  ['messages', {}],
  ['users', {}],
  ['build', {}],
  ['calls', {}],
  ['session', {}],
  ['push', {}],
  ['track', { TZ: 'Africa/Lagos' }],
  ['mock', { EXPO_PUBLIC_USE_MOCKS: 'true' }],
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
