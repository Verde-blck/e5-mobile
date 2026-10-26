import { env } from '@/config/env'
import { tokenStore } from '@/shared/lib/token'
import { emitUnauthorized } from '@/shared/lib/unauthorized'
import type { ApiAlarm } from '../api/alarms.wire'

// Read with fetch rather than EventSource, which can't send the Bearer header.

export type StreamStatus = 'connecting' | 'open' | 'down' | 'forbidden'

let status: StreamStatus = 'down'
const listeners = new Set<() => void>()

export const streamStatus = {
  get: (): StreamStatus => status,
  set(next: StreamStatus) {
    if (next === status) return
    status = next
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

// The id of the last alarm seen, sent as Last-Event-ID so a reconnect catches up.
let lastAlarmId: number | undefined
export const alarmCursor = {
  get: () => lastAlarmId,
  set(id: number) {
    lastAlarmId = id
  },
  reset() {
    lastAlarmId = undefined
  },
}

export interface SseEvent {
  event: string
  data: string
  id?: string
}

// Network chunks don't line up with events: one event can arrive in three pieces, or
// three in one, so what is left over is returned and prepended to the next chunk.
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  let rest = buffer.replace(/\r\n/g, '\n')
  const events: SseEvent[] = []

  for (;;) {
    const end = rest.indexOf('\n\n')
    if (end < 0) break
    const block = rest.slice(0, end)
    rest = rest.slice(end + 2)

    let event = 'message'
    let id: string | undefined
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
      else if (field === 'id') id = value
    }
    if (data.length > 0) events.push({ event, data: data.join('\n'), id })
  }

  return { events, rest }
}

export interface AlarmStreamOptions {
  onAlarm: (alarm: ApiAlarm) => void
  onUpdate: (alarm: ApiAlarm) => void
  url?: string
  fetchImpl?: typeof fetch
  getToken?: () => string | null
  onStatus?: (status: StreamStatus) => void
  onUnauthorized?: () => void
  cursor?: { get(): number | undefined; set(id: number): void }
  stallMs?: number
  sleep?: (ms: number) => Promise<void>
}

export const STALL_MS = 70_000
const MAX_BACKOFF_MS = 30_000

// Short-lived connections count as failures, so a server that hangs up at once isn't hammered.
const HEALTHY_MS = 10_000

export function backoffMs(attempt: number, random: number = Math.random()): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) + Math.floor(random * 500)
}

// Stops by itself only when retrying can't help: a dead token (401, or a 403 without the
// "forbidden" body), which ends the session, or an account that isn't allowed the stream.
export function connectAlarmStream(options: AlarmStreamOptions): { stop(): void } {
  const url = options.url ?? `${env.apiBaseUrl}/alarms/stream`
  const doFetch = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const getToken = options.getToken ?? (() => tokenStore.get())
  const setStatus = options.onStatus ?? streamStatus.set
  const unauthorized = options.onUnauthorized ?? emitUnauthorized
  const cursor = options.cursor ?? alarmCursor
  const stallMs = options.stallMs ?? STALL_MS

  let stopped = false
  let controller: AbortController | null = null
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  let wake: (() => void) | undefined

  const wait =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        wake = resolve
        sleepTimer = setTimeout(resolve, ms)
      }))

  function dispatch(event: SseEvent) {
    let alarm: ApiAlarm
    try {
      alarm = JSON.parse(event.data) as ApiAlarm
    } catch {
      return
    }
    if (event.event === 'alarm') {
      if (typeof alarm.id === 'number') cursor.set(alarm.id)
      options.onAlarm(alarm)
    } else if (event.event === 'alarm-update') {
      options.onUpdate(alarm)
    }
  }

  async function run() {
    let attempt = 0

    while (!stopped) {
      const attemptController = new AbortController()
      controller = attemptController
      let stallTimer: ReturnType<typeof setTimeout> | undefined
      let openedAt = 0

      try {
        setStatus('connecting')
        const token = getToken()
        if (!token) {
          setStatus('down')
          return
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        }
        const lastId = cursor.get()
        if (lastId !== undefined) headers['Last-Event-ID'] = String(lastId)

        const res = await doFetch(url, { headers, signal: attemptController.signal })

        if (res.status === 401 || res.status === 403) {
          const body: { error?: string } | null = await res.json().catch(() => null)
          if (res.status === 403 && body?.error === 'forbidden') {
            setStatus('forbidden')
          } else {
            setStatus('down')
            unauthorized()
          }
          return
        }
        if (!res.ok || !res.body) throw new Error(`Stream refused: HTTP ${res.status}`)

        setStatus('open')
        openedAt = Date.now()

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          clearTimeout(stallTimer)
          stallTimer = setTimeout(() => attemptController.abort(), stallMs)
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSse(buffer)
          buffer = parsed.rest
          parsed.events.forEach(dispatch)
        }
      } catch {
        // Dropped, stalled, or refused. Fall through to reconnect.
      } finally {
        clearTimeout(stallTimer)
      }

      if (stopped) break
      setStatus('down')

      const lived = openedAt ? Date.now() - openedAt : 0
      attempt = lived > HEALTHY_MS ? 0 : attempt + 1
      await wait(attempt === 0 ? 250 : backoffMs(attempt))
    }
  }

  void run().finally(() => {
    if (stopped) setStatus('down')
  })

  return {
    stop() {
      stopped = true
      clearTimeout(sleepTimer)
      wake?.()
      controller?.abort()
    },
  }
}
