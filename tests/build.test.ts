import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { createRunner } from './harness'

const { t, report } = createRunner()

// Tailwind scans all source text, comments and regexes included, for class-like strings. A pattern such
// as [-:T.Z] reads as an arbitrary property and emits invalid CSS: the web build shrugs it off, but
// NativeWind's native compiler fails with "Unexpected end of input" and the app won't bundle.
async function main() {
  const css = (() => {
    execSync('npx tailwindcss -c tailwind.config.js -i global.css -o /tmp/e5-tw-check.css', { stdio: 'pipe' })
    return fs.readFileSync('/tmp/e5-tw-check.css', 'utf8')
  })()

  await t('the generated style sheet is well formed: braces balance and it ends cleanly', () => {
    assert.equal(css.split('{').length, css.split('}').length, 'unbalanced braces')
    assert.match(css.trimEnd(), /\}$/)
  })
  await t('no source text has been read as an "arbitrary property" class (the kind that breaks the native build)', () => {
    const bad = [...css.matchAll(/^\.\\\[[^{]*\{/gm)].map((m) => m[0])
    assert.deepEqual(bad, [], 'source text that Tailwind treats as a class: ' + bad.join(' '))
  })
  await t('every brand colour and font class in the source is one the palette defines, and a plain one has a style (a typo here is a silently unstyled screen)', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []))
    const source = walk('src').map((f) => fs.readFileSync(f, 'utf8')).join('\n')
    const COLOURS = new Set<string>()
    const config = createRequire(`${process.cwd()}/`)('./tailwind.config.js') as { theme: { extend: { fontFamily: Record<string, unknown>; colors: { brand: Record<string, unknown> } } } }
    const FONTS = new Set(Object.keys(config.theme.extend.fontFamily).map((k) => `font-${k}`))
    for (const k of Object.keys(config.theme.extend.colors.brand)) COLOURS.add(k)
    const colourUses = [...source.matchAll(/(^|[^\w-])((?:[a-z-]+:)*)((?:bg|text|border|ring|fill|stroke|shadow|from|via|to|outline|divide|placeholder|caret|accent|decoration)-brand-([a-z]+))(?![\w-])/g)]
    const fontUses = [...source.matchAll(/(^|[^\w-])((?:[a-z-]+:)*)(font-(?:sans|display|mono)(?:-[a-z]+)?)(?![\w-])/g)]
    assert.ok(colourUses.length > 20 && fontUses.length > 20, 'the scan found the app\'s classes')
    for (const [, , , cls, name] of colourUses) assert.ok(COLOURS.has(name), `${cls} is not a brand colour (the palette has ${[...COLOURS].join(', ')})`)
    for (const [, , , cls] of fontUses) assert.ok(FONTS.has(cls), `${cls} is not a font the app defines`)
    for (const [, , variant, cls] of [...colourUses, ...fontUses].map((m) => [m[0], m[1], m[2], m[3] ?? m[3]] as const))
      if (!variant) assert.ok(css.includes('.' + cls + ' ') || css.includes('.' + cls + '{') || css.includes('.' + cls + ','), `${cls} has no style`)
  })
}
main().then(report)
