import type { HelmetSession } from './session'

export const WALL_MAX = 6

export const WALL_DATA_NOTE = 'Each uses about 0.9 GB of its mobile data per hour.'

export type WallBlock = 'full' | 'deactivated'

export function toggleSelection(selected: readonly string[], device: { id: string; active: boolean }, max: number = WALL_MAX): { selected: string[]; blocked?: WallBlock } {
  if (selected.includes(device.id)) return { selected: selected.filter((id) => id !== device.id) }
  if (!device.active) return { selected: [...selected], blocked: 'deactivated' }
  if (selected.length >= max) return { selected: [...selected], blocked: 'full' }
  return { selected: [...selected, device.id] }
}

export function wallColumns(width: number): 1 | 2 | 3 {
  return width >= 900 ? 3 : width >= 420 ? 2 : 1
}

export class WallSessions {
  private readonly sessions = new Map<string, HelmetSession>()
  private suspended: string[] = []
  private version = 0
  private readonly listeners = new Set<() => void>()
  private stopWatching: (() => void) | null = null

  constructor(
    private readonly create: (deviceId: string) => HelmetSession,
    private readonly watchApp: (callback: (inBackground: boolean) => void) => () => void
  ) {}

  // Safe to call again after `dispose` (React in development mounts, unmounts and
  // remounts a screen, and the same wall must keep working through that).
  attach(): void {
    if (this.stopWatching) return
    this.stopWatching = this.watchApp((inBackground) => {
      if (!inBackground) this.restartDropped()
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getVersion = (): number => this.version
  private changed() {
    this.version += 1
    this.listeners.forEach((l) => l())
  }

  get(deviceId: string): HelmetSession | null {
    return this.sessions.get(deviceId) ?? null
  }

  get running(): number {
    let n = 0
    this.sessions.forEach((s) => {
      if (s.getState().status !== 'ended') n += 1
    })
    return n
  }

  start(deviceId: string): void {
    this.sessions.get(deviceId)?.end()
    const session = this.create(deviceId)
    this.sessions.set(deviceId, session)
    this.changed()
    void session.start()
  }

  stop(deviceId: string): void {
    this.sessions.get(deviceId)?.end()
    this.sessions.delete(deviceId)
    this.changed()
  }

  stopAll(): void {
    this.sessions.forEach((s) => s.end())
    this.sessions.clear()
    this.suspended = []
    this.changed()
  }

  suspend(): void {
    const on = [...this.sessions.entries()].filter(([, s]) => s.getState().status !== 'ended').map(([id]) => id)
    this.sessions.forEach((s) => s.end())
    this.sessions.clear()
    this.suspended = on
    this.changed()
  }

  resume(): void {
    const again = this.suspended
    this.suspended = []
    again.forEach((id) => this.start(id))
  }

  private restartDropped(): void {
    const dropped = [...this.sessions.entries()].filter(([, s]) => {
      const st = s.getState()
      return st.status === 'ended' && st.endReason === 'left-app'
    })
    dropped.forEach(([id]) => this.start(id))
  }

  dispose(): void {
    this.stopWatching?.()
    this.stopWatching = null
    this.sessions.forEach((s) => s.end())
    this.sessions.clear()
    this.suspended = []
  }
}
