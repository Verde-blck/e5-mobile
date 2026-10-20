import assert from 'node:assert/strict'
import { BroadcastUnavailable, broadcastAvailable, sendBroadcast } from '@/modules/group-call/api/broadcast.api'
import { sendVoiceMessage } from '@/modules/messaging/api/messages.api'
import { createRunner, installHttp } from './harness'

// Run WITHOUT the switch: what a real build does until the request has been checked against the backend.
const { t, report } = createRunner()
const http = installHttp()

async function main() {
  await t('a real build with the switch off offers no voice messages and sends nothing, so an unchecked request can never reach the backend', async () => {
    assert.equal(broadcastAvailable(), false)
    http.calls.length = 0
    await assert.rejects(sendBroadcast(['a'], { uri: 'file:///x.m4a', name: 'x.m4a', mimeType: 'audio/mp4' }), (e: Error) => e instanceof BroadcastUnavailable && /not switched on/.test(e.message))
    assert.equal(http.calls.length, 0, 'no request was made')
  })
  await t('and a single voice message to one helmet is refused the same way, with no request', async () => {
    http.calls.length = 0
    await assert.rejects(sendVoiceMessage('d1', { uri: 'file:///x.m4a', name: 'x.m4a', mimeType: 'audio/mp4' }), (e: Error) => e instanceof BroadcastUnavailable)
    assert.equal(http.calls.length, 0)
  })
}
main().then(report)
