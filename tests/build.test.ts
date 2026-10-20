import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { createRunner } from './harness'

const { t, report } = createRunner()

// Tailwind scans ALL source text (comments and regexes included) for things that look like class names.
// A pattern such as [-:T.Z] reads as an "arbitrary property" and emits invalid CSS: the web build shrugs it
// off, but NativeWind's native compiler fails with "Unexpected end of input" and the app won't bundle.
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
    // Legitimate arbitrary VALUES look like .text-\[10px\]; an arbitrary PROPERTY starts the selector with the bracket.
    const bad = [...css.matchAll(/^\.\\\[[^{]*\{/gm)].map((m) => m[0])
    assert.deepEqual(bad, [], 'source text that Tailwind treats as a class: ' + bad.join(' '))
  })
  await t('every colour and font class the app uses resolves (a typo here is a silently unstyled screen)', () => {
    for (const cls of ['bg-brand-primary', 'text-brand-secondary', 'bg-brand-tint', 'text-brand-soft', 'font-display-extrabold', 'font-mono', 'font-sans-semibold'])
      assert.ok(css.includes('.' + cls + ' ') || css.includes('.' + cls + '{'), cls + ' has no style')
  })
}
main().then(report)
