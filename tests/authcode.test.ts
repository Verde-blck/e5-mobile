import assert from 'node:assert/strict'
import { cleanCode, codeRefusal, isCompleteCode } from '@/modules/auth/lib/code'
import { errorReason, errorReference } from '@/shared/lib/errors'
import { buttonShadow } from '@/modules/auth/lib/shadow'
import { createRunner } from './harness'

const { t, report } = createRunner()

const failure = (status?: number, data?: unknown) => (status === undefined ? new Error('Network Error') : { response: { status, data } })

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
  await t('a refused code shows the server\'s own reason, so a wrong code can be told from an expired or spent challenge when someone quotes it', () => {
    assert.equal(errorReference(failure(401, { error: 'invalid_code' })), '401 invalid_code')
    assert.equal(errorReference(failure(400, { message: 'Token expired' })), '400 Token expired')
    assert.equal(errorReference(failure(401)), '401', 'no body: just the status')
    assert.equal(errorReference(failure()), '', 'no reply at all: nothing to quote')
    assert.equal(errorReference(failure(401, { error: '<b>bad</b> & "odd" characters!' })), '401 bbadb  odd characters', 'only safe characters')
    assert.ok(errorReference(failure(400, { message: 'x'.repeat(300) })).length <= 44, 'kept short')
  })
  await t('the server\'s own short reason is read from the reply', () => {
    assert.equal(errorReason(failure(401, { error: 'challenge_expired' })), 'challenge_expired')
    assert.equal(errorReason(failure(401, { error: '  Invalid or expired code ' })), 'Invalid or expired code')
    for (const none of [failure(401), failure(401, { error: '' }), failure(401, { error: 5 }), failure()]) assert.equal(errorReason(none), undefined)
  })
  await t('each error the backend document lists gets its own plain message, and only a lost sign-in restarts it', () => {
    const expired = codeRefusal(failure(401, { error: 'challenge_expired' }))
    assert.equal(expired.restart, true); assert.match(expired.message, /timed out, so a new one was started\. Enter your code again\./)
    const wrong = codeRefusal(failure(401, { error: 'Invalid or expired code' }))
    assert.equal(wrong.restart, false, 'the same challenge still works after a wrong code'); assert.match(wrong.message, /^That code didn't work\..*date and time/)
    const used = codeRefusal(failure(401, { error: 'code_already_used' }))
    assert.equal(used.restart, false); assert.match(used.message, /already used\. Wait for the next one, which comes every 30 seconds/)
    for (const lock of [failure(429, { error: 'too_many_attempts' }), failure(401, { error: 'too_many_attempts' })]) assert.deepEqual(codeRefusal(lock), { message: 'Too many wrong codes. Wait 15 minutes and try again.', restart: false })
  })
  await t('a refusal the document does not list still shows its reference, and server or network trouble says so', () => {
    const unknown = codeRefusal(failure(401, { error: 'something_new' })); assert.equal(unknown.restart, false); assert.match(unknown.message, /\(Reference: 401 something_new\)$/)
    assert.match(codeRefusal(failure(400)).message, /\(Reference: 400\)$/)
    assert.deepEqual(codeRefusal(failure(503)), { message: 'The server had a problem. Try again shortly.', restart: false })
    assert.deepEqual(codeRefusal(failure()), { message: "Can't reach the server. Check your connection and try again.", restart: false })
  })
}
main().then(report)
