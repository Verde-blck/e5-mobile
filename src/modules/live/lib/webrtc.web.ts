import type { StreamLike } from '../types'
import { MOCK_URL_PREFIX, SessionEndedError, exchange, type MediaConnection } from './signalling'

function wrap(pc: RTCPeerConnection, stream: MediaStream): MediaConnection {
  let lost: (() => void) | null = null
  let fired = false
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' && !fired) {
      fired = true
      lost?.()
    }
  })
  return { stream: stream as unknown as StreamLike, close: () => pc.close(), onLost: (callback) => { lost = callback } }
}

export async function play(watchUrl: string, signal: AbortSignal): Promise<MediaConnection> {
  if (watchUrl.startsWith(MOCK_URL_PREFIX)) return mockPlay(signal)

  const pc = new RTCPeerConnection()
  try {
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    const stream = new MediaStream()
    pc.addEventListener('track', (e) => stream.addTrack(e.track))
    await exchange(watchUrl, pc, signal)
    return wrap(pc, stream)
  } catch (error) {
    pc.close()
    throw error
  }
}

export async function push(pushUrl: string, media: StreamLike, signal: AbortSignal): Promise<MediaConnection> {
  if (pushUrl.startsWith(MOCK_URL_PREFIX)) return { stream: new MediaStream() as unknown as StreamLike, close: () => {}, onLost: () => {} }

  const pc = new RTCPeerConnection()
  try {
    ;(media as unknown as MediaStream).getTracks().forEach((track) => pc.addTransceiver(track, { direction: 'sendonly' }))
    await exchange(pushUrl, pc, signal)
    return wrap(pc, new MediaStream())
  } catch (error) {
    pc.close()
    throw error
  }
}

async function mockPlay(signal: AbortSignal): Promise<MediaConnection> {
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  if (signal.aborted) throw new SessionEndedError()

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  let frame = 0
  const timer = setInterval(() => {
    if (!ctx) return
    frame++
    ctx.fillStyle = '#0C352F'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'rgba(163,226,215,0.25)'
    for (let x = (frame * 2) % 40; x < canvas.width; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    ctx.fillStyle = '#A3E2D7'
    ctx.font = '600 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Mock helmet camera', canvas.width / 2, canvas.height / 2 - 6)
    ctx.font = '14px monospace'
    ctx.fillText(new Date().toLocaleTimeString(), canvas.width / 2, canvas.height / 2 + 22)
  }, 100)

  const stream = canvas.captureStream(10)
  return {
    stream: stream as unknown as StreamLike,
    close: () => {
      clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
    },
    onLost: () => {},
  }
}
