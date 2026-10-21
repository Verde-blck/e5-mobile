import assert from 'node:assert/strict'
import { BroadcastUnavailable, broadcastAvailable } from '@/modules/group-call/api/broadcast.api'
import { sendVoiceMessage } from '@/modules/messaging/api/messages.api'
import { createRunner, installHttp } from './harness'

// Run WITHOUT the switch: what a real build does until the request has been checked against the backend.
const { t, report } = createRunner()
const http = installHttp()

async function main() {
  await t('a real build with the switch off offers no voice-message sending, so an unchecked request can never reach the backend', () => {
    assert.equal(broadcastAvailable(), false)
  })
  await t('and sending a voice message to a helmet is refused, with no request made', async () => {
    http.calls.length = 0
    await assert.rejects(sendVoiceMessage('d1', { uri: 'file:///x.m4a', name: 'x.m4a', mimeType: 'audio/mp4' }), (e: Error) => e instanceof BroadcastUnavailable)
    assert.equal(http.calls.length, 0)
  })
}
main().then(report)
