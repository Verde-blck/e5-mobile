import assert from 'node:assert/strict'
import { passwordChangeError, userFromProfile } from '@/modules/auth/api/auth.api'
import { validatePasswordChange } from '@/modules/auth/lib/password'
import { apiClient } from '@/shared/lib/api-client'
import { isPasswordChangeRequired } from '@/shared/lib/errors'
import { onPasswordChangeRequired, onSetupRequired, onUnauthorized } from '@/shared/lib/unauthorized'
import { useAuthStore, type AuthUser } from '@/shared/store/authStore'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const e = (status?: number, error?: string) => (status === undefined ? {} : { response: { status, data: error ? { error } : undefined } })
const user = (over: Partial<AuthUser> = {}): AuthUser => ({ id: 'u', username: 'u', name: 'u', role: 'r', permissions: [], ...over })

async function main() {
  await t('the profile says whether this account must choose its own password, always read as a plain yes or no', () => {
    assert.equal(userFromProfile({ username: 'a', mustChangePassword: true }, 'a').mustChangePassword, true)
    assert.equal(userFromProfile({ username: 'a', mustChangePassword: false }, 'a').mustChangePassword, false)
    assert.equal(userFromProfile({ username: 'a' }, 'a').mustChangePassword, false, 'absent is false')
    assert.equal(userFromProfile({ username: 'a', mustChangePassword: 'yes' as never }, 'a').mustChangePassword, false, 'only a real true counts')
  })
  await t('"password change required" is recognised only by its own refusal', () => {
    assert.equal(isPasswordChangeRequired(e(403, 'password_change_required')), true)
    for (const other of [e(403, 'forbidden'), e(403, '2fa_setup_required'), e(403), e(401, 'password_change_required'), e(500), e(), null, undefined]) assert.equal(isPasswordChangeRequired(other), false)
  })
  await t('that refusal raises its own signal and does not sign the person out; an expired token still does', async () => {
    let change = 0; let setup = 0; let signedOut = 0
    const offs = [onPasswordChangeRequired(() => (change += 1)), onSetupRequired(() => (setup += 1)), onUnauthorized(() => (signedOut += 1))]
    try {
      http.routes = { 'GET /devices': () => ({ status: 403, data: { error: 'password_change_required' } }) }
      await assert.rejects(apiClient.get('/devices')); assert.deepEqual([change, setup, signedOut], [1, 0, 0], 'sent to choose a password, not logged out in a circle')
      http.routes = { 'GET /devices': () => ({ status: 403, data: { error: '2fa_setup_required' } }) }
      await assert.rejects(apiClient.get('/devices')); assert.deepEqual([change, setup, signedOut], [1, 1, 0], 'the two-step signal is separate')
      http.routes = { 'GET /devices': () => ({ status: 403 }) }
      await assert.rejects(apiClient.get('/devices')); assert.deepEqual([change, setup, signedOut], [1, 1, 1], 'a bare 403 is an expired token')
    } finally { offs.forEach((off) => off()) }
  })
  await t('a wrong current password on the change screen is the person mistyping, not a dead session', async () => {
    let signedOut = 0; const off = onUnauthorized(() => (signedOut += 1))
    try {
      http.routes = { 'POST /auth/change-password': () => ({ status: 401, data: { error: 'wrong_current_password' } }) }
      await assert.rejects(apiClient.post('/auth/change-password', { currentPassword: 'x', newPassword: 'y' })); assert.equal(signedOut, 0)
    } finally { off() }
  })
  await t('the store can be told a change is required, and only does anything for someone signed in', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false }); useAuthStore.getState().requirePasswordChange(); assert.equal(useAuthStore.getState().user, null)
    useAuthStore.setState({ user: user({ mustChangePassword: false }), isAuthenticated: true }); useAuthStore.getState().requirePasswordChange()
    assert.equal(useAuthStore.getState().user?.mustChangePassword, true); useAuthStore.getState().requirePasswordChange(); assert.equal(useAuthStore.getState().user?.mustChangePassword, true, 'again changes nothing')
  })

  await t('a new password must be filled in, at least 8 characters, and confirmed', () => {
    assert.deepEqual(validatePasswordChange({ current: '', next: '', confirm: '' }), { current: 'Enter your current password', next: 'Use at least 8 characters', confirm: 'Confirm your new password' })
    assert.deepEqual(validatePasswordChange({ current: 'old', next: 'short', confirm: 'short' }), { next: 'Use at least 8 characters' })
    assert.deepEqual(validatePasswordChange({ current: 'old', next: 'longenough', confirm: '' }), { confirm: 'Confirm your new password' })
    assert.deepEqual(validatePasswordChange({ current: 'old', next: 'exactly8', confirm: 'exactly8' }), {}, 'eight is enough')
  })
  await t('the two new entries must match, and the new password must differ from the current one', () => {
    assert.deepEqual(validatePasswordChange({ current: 'oldpassword', next: 'newpassword', confirm: 'newpassworD' }), { confirm: "Those don't match" })
    assert.deepEqual(validatePasswordChange({ current: 'samepassword', next: 'samepassword', confirm: 'samepassword' }), { next: 'Choose something different from your current password' })
    assert.deepEqual(validatePasswordChange({ current: 'samepassword', next: 'samepassword', confirm: 'other-entry' }), { confirm: "Those don't match", next: 'Choose something different from your current password' }, 'both problems are shown')
  })
  await t('comparing the fields waits until each is filled in properly', () => {
    assert.deepEqual(validatePasswordChange({ current: 'oldpassword', next: 'abc', confirm: 'xyz' }), { next: 'Use at least 8 characters' }, 'the short password is the first thing to fix, not the mismatch')
  })

  await t('each reason the server gives for refusing a change comes out in words a person can act on', () => {
    assert.equal(passwordChangeError(e(401, 'wrong_current_password')), "That current password isn't right.")
    assert.equal(passwordChangeError(e(400, 'password_too_short')), 'Your new password needs at least 8 characters.')
    assert.equal(passwordChangeError(e(400, 'same_password')), "Choose a new password that's different from your current one.")
    assert.equal(passwordChangeError(e(401)), "That current password isn't right.", 'a bare 401 here means the current password')
    assert.equal(passwordChangeError(e(500)), 'Could not change your password. Please try again.')
    assert.equal(passwordChangeError(e(429)), 'Could not change your password. Please try again.')
  })
  await t('no response at all is reported as a connection problem, not blamed on the password', () => {
    assert.equal(passwordChangeError(e()), 'Could not reach the server. Check your connection and try again.')
    assert.equal(passwordChangeError(new Error('Network Error')), 'Could not reach the server. Check your connection and try again.')
  })
}
main().then(report)
