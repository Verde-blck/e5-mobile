import assert from 'node:assert/strict'
import { cleanCode, codeRefusal, isCompleteCode } from '@/modules/auth/lib/code'
import { errorReference } from '@/shared/lib/errors'
import { buttonShadow } from '@/modules/auth/lib/shadow'
import { createRunner } from './harness'

const { t, report } = createRunner()

async function main() {
  await t('the code box keeps only digits, at most six, whatever was typed, pasted or autofilled', () => {
    assert.equal(cleanCode('123456'), '123456')
    assert.equal(cleanCode('123 456'), '123456', 'a code copied with a space')
    assert.equal(cleanCode('12-34-56'), '123456')
    assert.equal(cleanCode('ab12c3'), '123')
    assert.equal(cleanCode('1234567890'), '123456', 'longer than six is cut')
    assert.equal(cleanCode(''), '')
  })
  await t('only exactly six digits count as a code, so five never submit and the sixth does', () => {
    for (const n of ['', '1', '12345']) assert.equal(isCompleteCode(n), false, n)
    for (const ok of ['000000', '123456', '909521']) assert.equal(isCompleteCode(ok), true, ok)
    for (const bad of ['1234567', '12345a', '12 456', '１２３４５６']) assert.equal(isCompleteCode(bad), false, bad)
    assert.equal(isCompleteCode(cleanCode('12345')), false); assert.equal(isCompleteCode(cleanCode('123456')), true)
  })
  await t('the button never gets the combined inner shadow on an Apple device, where it left the background undrawn', () => {
    const colour = { solid: '#0A6659', soft: 'rgba(10, 102, 89, 0.7)' }
    const apple = buttonShadow('ios', colour) as Record<string, unknown>
    assert.ok(!('boxShadow' in apple), 'no boxShadow on iOS'); assert.equal(apple.shadowColor, '#0A6659'); assert.ok(apple.shadowRadius && apple.shadowOpacity)
    for (const os of ['android', 'web']) {
      const other = buttonShadow(os, colour) as { boxShadow?: string }
      assert.match(other.boxShadow ?? '', /^inset 0 1px 0 /, `${os} keeps the look it always had`); assert.ok(!('shadowColor' in other))
    }
  })
  const failure = (status?: number, data?: unknown) => (status === undefined ? new Error('Network Error') : { response: { status, data } })
  await t('a refused code shows the server\'s own reason, so a wrong code can be told from an expired or spent challenge when someone quotes it', () => {
    assert.equal(errorReference(failure(401, { error: 'invalid_code' })), '401 invalid_code')
    assert.equal(errorReference(failure(400, { message: 'Token expired' })), '400 Token expired')
    assert.equal(errorReference(failure(401)), '401', 'no body: just the status')
    assert.equal(errorReference(failure()), '', 'no reply at all: nothing to quote')
    assert.equal(errorReference(failure(401, { error: '<b>bad</b> & "odd" characters!' })), '401 bbadb  odd characters', 'only safe characters')
    assert.ok(errorReference(failure(400, { message: 'x'.repeat(300) })).length <= 44, 'kept short')
  })
  await t('a 400 or 401 asks for a new login challenge before the next try, and other failures do not', () => {
    for (const status of [400, 401]) {
      const r = codeRefusal(failure(status, { error: 'invalid_code' }))
      assert.equal(r.freshChallenge, true, String(status)); assert.match(r.message, /^That code didn't work\./); assert.match(r.message, /\(Reference: \d{3} invalid_code\)$/)
    }
    assert.match(codeRefusal(failure(401)).message, /\(Reference: 401\)$/)
    assert.deepEqual(codeRefusal(failure(429)), { message: 'Too many attempts. Wait a minute and try again.', freshChallenge: false })
    assert.deepEqual(codeRefusal(failure(503)), { message: 'The server had a problem. Try again shortly.', freshChallenge: false })
    assert.deepEqual(codeRefusal(failure()), { message: "Can't reach the server. Check your connection and try again.", freshChallenge: false })
  })
}
main().then(report)
