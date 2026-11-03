import { create } from 'zustand'
import type { Alarm } from '../types'

interface AlertState {
  // Alarms someone has acted on (a button on the pop-up, or opening the alarm): their siren stops and their box goes away.
  silenced: Record<string, true>
  banner: { alarm: Alarm; key: number } | null
  silence: (ids: string[]) => void
  showBanner: (alarm: Alarm) => void
  dismissBanner: () => void
  reset: () => void
}

let bannerKey = 0

export const useAlertStore = create<AlertState>((set) => ({
  silenced: {},
  banner: null,
  silence: (ids) =>
    set((state) => ({
      silenced: { ...state.silenced, ...Object.fromEntries(ids.map((id) => [id, true as const])) },
    })),
  showBanner: (alarm) => set({ banner: { alarm, key: ++bannerKey } }),
  dismissBanner: () => set({ banner: null }),
  reset: () => set({ silenced: {}, banner: null }),
}))
