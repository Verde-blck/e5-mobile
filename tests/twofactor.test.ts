import assert from 'node:assert/strict'
import { describeTwoFactorError, startTwoFactorSetup, userFromProfile } from '@/modules/auth/api/auth.api'
import { fetchSecurityPolicy, resetAdminTwoFactor, setSecurityPolicy } from '@/modules/users/api/admins.api'
import { apiClient } from '@/shared/lib/api-client'
import { isSetupRequired } from '@/shared/lib/errors'
import { onSetupRequired, onUnauthorized } from '@/shared/lib/unauthorized'
import { useAuthStore, type AuthUser } from '@/shared/store/authStore'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const e = (status: number, error?: string) => ({ response: { status, data: error ? { error } : undefined } })
const user = (over: Partial<AuthUser> = {}): AuthUser => ({ id: 'u', username: 'u', name: 'u', role: 'r', permissions: [], ...over })

async function main() {
  await t('the profile says whether this account must set up two-step verification (always read as a plain yes or no)', () => {
    assert.equal(userFromProfile({ username: 'a', mustSetup2fa: true }, 'a').mustSetup2fa, true); assert.equal(userFromProfile({ username: 'a', mustSetup2fa: false }, 'a').mustSetup2fa, false)
    assert.equal(userFromProfile({ username: 'a' }, 'a').mustSetup2fa, false, 'absent is false'); assert.equal(userFromProfile({ username: 'a', mustSetup2fa: 'yes' as never }, 'a').mustSetup2fa, false, 'only a real true counts')
  })
  await t('"set-up required" is recognised only by its own refusal, and is not confused with a permission refusal or an expired token', () => {
    assert.equal(isSetupRequired(e(403, '2fa_setup_required')), true); assert.equal(isSetupRequired(e(403, 'forbidden')), false); assert.equal(isSetupRequired(e(403)), false); assert.equal(isSetupRequired(e(401, '2fa_setup_required')), false); assert.equal(isSetupRequired(null), false)
  })
  await t('a "set up 2FA first" refusal raises the set-up signal and does NOT sign the person out; an expired token still does', async () => {
    let setup = 0; let signedOut = 0; const offA = onSetupRequired(() => (setup += 1)); const offB = onUnauthorized(() => (signedOut += 1))
    try {
      http.routes = { 'GET /devices': () => ({ status: 403, data: { error: '2fa_setup_required' } }) }; await assert.rejects(apiClient.get('/devices'))
      assert.deepEqual([setup, signedOut], [1, 0], 'the person is sent to set up 2FA, not logged out in a circle')
      http.routes = { 'GET /devices': () => ({ status: 403 }) }; await assert.rejects(apiClient.get('/devices')); assert.deepEqual([setup, signedOut], [1, 1], 'a bare 403 is an expired token')
      http.routes = { 'GET /devices': () => ({ status: 403, data: { error: 'forbidden' } }) }; await assert.rejects(apiClient.get('/devices')); assert.deepEqual([setup, signedOut], [1, 1], 'a permission refusal changes nothing')
      http.routes = { 'GET /devices': () => ({ status: 401 }) }; await assert.rejects(apiClient.get('/devices')); assert.deepEqual([setup, signedOut], [1, 2])
    } finally { offA(); offB() }
  })
  await t('the store can be told set-up is required, and only does anything for someone signed in', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false }); useAuthStore.getState().requireSetup(); assert.equal(useAuthStore.getState().user, null)
    useAuthStore.setState({ user: user({ mustSetup2fa: false }), isAuthenticated: true }); useAuthStore.getState().requireSetup(); assert.equal(useAuthStore.getState().user?.mustSetup2fa, true); useAuthStore.setState({ user: null, isAuthenticated: false })
  })
  await t('setting up with 2FA off sends no body; moving to a new phone sends the CURRENT code', async () => {
    http.calls.length = 0; http.routes = { 'POST /auth/2fa/setup': () => ({ status: 200, data: { secret: 'S', otpAuthUrl: 'otpauth://x' } }) }
    await startTwoFactorSetup('u'); assert.equal(http.calls[0].data, undefined, 'no body when 2FA is off'); await startTwoFactorSetup('u', '123456'); assert.deepEqual(http.calls[1].data, { code: '123456' })
  })
  await t('the 409 answers say what to do: already on, so enter the current code; required by the company, so it can\'t be turned off', () => {
    assert.match(describeTwoFactorError(e(409, '2fa_already_enabled'), 'x'), /already on.*current code.*new phone/); assert.match(describeTwoFactorError(e(409, '2fa_required_by_company'), 'x'), /company requires.*can't be turned off/)
    assert.equal(describeTwoFactorError(e(401), "That code didn't match."), "That code didn't match."); assert.match(describeTwoFactorError(e(429), 'x'), /Too many attempts/); assert.match(describeTwoFactorError({}, 'x'), /Can't reach the server/)
  })
  await t('resetting someone\'s two-step verification is POST /admins/{id}/2fa/reset; the company policy is read and set at /settings/security', async () => {
    http.calls.length = 0
    http.routes = { 'POST /admins/7/2fa/reset': () => ({ status: 200, data: { id: 7, username: 'x', twoFactorEnabled: false, permissions: [], deviceIds: [] } }), 'GET /settings/security': () => ({ status: 200, data: { require2fa: true } }), 'PUT /settings/security': (c) => ({ status: 200, data: c.data }) }
    assert.equal((await resetAdminTwoFactor(7)).twoFactorEnabled, false); assert.deepEqual(await fetchSecurityPolicy(), { require2fa: true }); assert.deepEqual(await setSecurityPolicy(false), { require2fa: false }); assert.deepEqual(http.calls[2].data, { require2fa: false })
    http.routes = { 'GET /settings/security': () => ({ status: 200, data: {} }) }; assert.deepEqual(await fetchSecurityPolicy(), { require2fa: false }, 'absent is off')
  })
}
main().then(report)
