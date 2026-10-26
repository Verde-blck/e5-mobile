import type { StreamLike } from '../types'

export interface PeerLike {
  createOffer(): Promise<{ sdp?: string }>
  setLocalDescription(description: { sdp?: string }): Promise<void>
  setRemoteDescription(description: { type: 'answer'; sdp: string }): Promise<void>
}

export interface MediaConnection {
  stream: StreamLike
  close: () => void
  onLost: (callback: () => void) => void
}

export class NotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotReadyError'
  }
}

// (Hermes has no DOMException, so it is our own.)
export class SessionEndedError extends Error {
  constructor() {
    super('Session ended')
    this.name = 'AbortError'
  }
}

// Each attempt gives up after this long, so a stalled request can't hang a retry loop.
export const ATTEMPT_TIMEOUT_MS = 8_000

export async function exchange(url: string, pc: PeerLike, signal: AbortSignal, fetchImpl: typeof fetch = fetch, timeoutMs: number = ATTEMPT_TIMEOUT_MS): Promise<void> {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), timeoutMs)
  const abort = () => timeout.abort()
  signal.addEventListener('abort', abort)

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      body: offer.sdp,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: timeout.signal,
    })
    const json = (await res.json()) as { code?: number; sdp?: string; msg?: string }
    if (json.code !== 0 || !json.sdp) throw new NotReadyError(json.msg ?? `Media server answered code ${json.code}`)
    await pc.setRemoteDescription({ type: 'answer', sdp: json.sdp })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export async function connectWithRetry(
  attempt: () => Promise<MediaConnection>,
  signal: AbortSignal,
  { intervalMs = 2_000, deadlineMs = 30_000 }: { intervalMs?: number; deadlineMs?: number } = {}
): Promise<MediaConnection> {
  const giveUpAt = Date.now() + deadlineMs
  let lastError: unknown = null

  while (!signal.aborted && Date.now() < giveUpAt) {
    try {
      return await attempt()
    } catch (error) {
      lastError = error
      if (signal.aborted) break
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  if (signal.aborted) throw new SessionEndedError()
  throw lastError ?? new Error('Could not connect')
}

export const MOCK_URL_PREFIX = 'mock:'
