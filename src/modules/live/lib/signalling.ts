import type { StreamLike } from '../types'

/*
 * WebRTC with the media server (ZLMediaKit), as in the backend's guide and the web dashboard.
 *
 * The exchange is one HTTP request: our SDP offer is POSTed as plain text and the answer comes back as
 * { code, sdp }. code 0 means connected; anything else usually means the helmet hasn't started sending video yet,
 * which is normal for the first 5 to 10 seconds, so callers retry. There are no STUN or TURN servers: the media
 * server's answer carries its own address.
 *
 * Nothing in this file touches a platform: it works with anything shaped like a peer connection, so it is tested
 * with fakes and shared by the browser preview and the tablet.
 */

export interface PeerLike {
  createOffer(): Promise<{ sdp?: string }>
  setLocalDescription(description: { sdp?: string }): Promise<void>
  setRemoteDescription(description: { type: 'answer'; sdp: string }): Promise<void>
}

export interface MediaConnection {
  /** Incoming audio and video. Empty for a send-only connection. */
  stream: StreamLike
  close: () => void
  /** Called once if the connection drops after it was established. */
  onLost: (callback: () => void) => void
}

export class NotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotReadyError'
  }
}

/** The session was ended while this was in progress. (Hermes has no DOMException, so it is our own.) */
export class SessionEndedError extends Error {
  constructor() {
    super('Session ended')
    this.name = 'AbortError'
  }
}

/** Each attempt gives up after this long, so a stalled request can't hang a retry loop. */
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

/**
 * Repeats an attempt every couple of seconds until it works, the deadline passes, or the session ends. The
 * guide's timing: the stream is ready 5 to 10 seconds after start, so retry every 2 seconds.
 */
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

/** Mock addresses (sample data mode), answered by a generated stream instead of a media server. */
export const MOCK_URL_PREFIX = 'mock:'
