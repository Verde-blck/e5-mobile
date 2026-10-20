import type { HelmetSession } from './session'

/** Cypher's suggestion in the web: six fits a 3 by 2 grid and keeps mobile data use sensible. */
export const WALL_MAX = 6

/** What the web tells the operator about the cost of leaving a helmet streaming. */
export const WALL_DATA_NOTE = 'Each uses about 0.9 GB of its mobile data per hour.'

export type WallBlock = 'full' | 'deactivated'

/**
 * Add a helmet to the wall, or take it off if it is already there. A deactivated helmet can't be added, and the wall
 * holds six. Removing is always allowed.
 */
export function toggleSelection(selected: readonly string[], device: { id: string; active: boolean }, max: number = WALL_MAX): { selected: string[]; blocked?: WallBlock } {
  if (selected.includes(device.id)) return { selected: selected.filter((id) => id !== device.id) }
  if (!device.active) return { selected: [...selected], blocked: 'deactivated' }
  if (selected.length >= max) return { selected: [...selected], blocked: 'full' }
  return { selected: [...selected, device.id] }
}

/** How many tiles across, by the width the grid really has: one narrow, two by default, three on a wide tablet. */
export function wallColumns(width: number): 1 | 2 | 3 {
  return width >= 900 ? 3 : width >= 420 ? 2 : 1
}

/**
 * The live sessions behind the wall, one per helmet (ported from the web's useWallSessions).
 *
 * Every tile is its own session, so one helmet's weak signal never touches the others. A plain object, like the
 * session itself, so it can be tested without React and outlives any one component.
 *
 * Leaving the wall disconnects from every helmet (`suspend`); coming back reconnects the same ones (`resume`). A
 * tablet also can't keep streams in the background: each session ends itself after a few seconds out of sight, and
 * when the app returns the ones that ended that way are started again. Sessions the operator stopped stay stopped.
 */
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

  /**
   * Start listening for the app returning to the front. Safe to call again after `dispose` (React in development
   * mounts, unmounts and remounts a screen, and the same wall must keep working through that).
   */
  attach(): void {
    if (this.stopWatching) return
    this.stopWatching = this.watchApp((inBackground) => {
      if (!inBackground) this.restartDropped()
    })
  }

  // --- For useSyncExternalStore ------------------------------------------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getVersion = (): number => this.version
  private changed() {
    this.version += 1
    this.listeners.forEach((l) => l())
  }

  // --- The sessions --------------------------------------------------------
  get(deviceId: string): HelmetSession | null {
    return this.sessions.get(deviceId) ?? null
  }

  /** Helmets currently connected or connecting. */
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

  /** Leaving the wall: disconnect from everything, remembering which helmets were on. */
  suspend(): void {
    const on = [...this.sessions.entries()].filter(([, s]) => s.getState().status !== 'ended').map(([id]) => id)
    this.sessions.forEach((s) => s.end())
    this.sessions.clear()
    this.suspended = on
    this.changed()
  }

  /** Back on the wall: reconnect the helmets that were on. */
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
