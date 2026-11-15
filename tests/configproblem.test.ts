import assert from 'node:assert/strict'
import { QueryClient } from '@tanstack/react-query'
import { restoreSession } from '@/modules/auth/api/auth.api'
import { fetchBranding } from '@/modules/branding/api/branding.api'
import { prefetchBranding } from '@/modules/branding/hooks/useBranding'
import { connectAlarmStream } from '@/modules/alarms/lib/alarmStream'
import { env } from '@/config/env'
import { apiClient } from '@/shared/lib/api-client'
import { isConfigProblem } from '@/shared/lib/errors'
import { tokenStore } from '@/shared/lib/token'
import { onUnauthorized } from '@/shared/lib/unauthorized'
import { createRunner, installHttp } from './harness'

// This suite runs with no server address at all (see run.mjs). Its point is that a build in that state sends nothing, anywhere.
const { t, report } = createRunner()
const http = installHttp()

async function main() {
  await t('this build has no address, and says so', () => {
    assert.equal(env.apiBaseUrl, ''); assert.match(env.configProblem ?? '', /no server address/)
  })
  await t('a request is refused before it is sent, and nothing reaches the network layer', async () => {
    http.calls.length = 0; http.routes = { 'GET /devices': () => ({ status: 200, data: [] }) }
    await assert.rejects(apiClient.get('/devices'), (error) => isConfigProblem(error))
    assert.equal(http.calls.length, 0, 'no request was made')
  })
  await t('a saved login is never attached to anything, because the request stops first', async () => {
    http.calls.length = 0
    await Promise.resolve(tokenStore.set('secret-saved-token'))
    await assert.rejects(apiClient.post('/auth/login', { username: 'a', password: 'b' }), (error) => isConfigProblem(error))
    await assert.rejects(apiClient.get('/auth/me'), (error) => isConfigProblem(error))
    assert.equal(http.calls.length, 0, 'nothing was sent, so the token went nowhere')
  })
  await t('restoring a saved login makes no request', async () => {
    http.calls.length = 0
    await restoreSession().catch(() => null)
    assert.equal(http.calls.length, 0)
  })
  await t('fetching branding makes no request, and never makes the app sign the person out', async () => {
    http.calls.length = 0
    let signedOut = 0; const off = onUnauthorized(() => (signedOut += 1))
    try {
      await assert.rejects(fetchBranding(), (error) => isConfigProblem(error))
      await prefetchBranding(new QueryClient())
    } finally { off() }
    assert.equal(http.calls.length, 0); assert.equal(signedOut, 0, 'a configuration problem is not an expired login')
  })
  await t('the alarm stream does not even try, though it is not sent through the API client', async () => {
    let asked = 0
    const stream = connectAlarmStream({ fetchImpl: () => { asked += 1; return Promise.reject(new Error('should not be called')) }, getToken: () => 'token', onStatus: () => {}, onUnauthorized: () => {}, onAlarm: () => {}, onUpdate: () => {} })
    await new Promise((resolve) => setTimeout(resolve, 40)); stream.stop()
    assert.equal(asked, 0)
  })
}
main().then(report)
