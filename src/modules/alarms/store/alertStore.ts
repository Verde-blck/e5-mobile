import { create } from 'zustand'
import type { Alarm } from '../types'

interface AlertState {
  /** Alarms whose siren has been silenced on this phone. Not shared, not saved. */
  silenced: Record<string, true>
  /** The brief in-app notice for a non-critical alarm. */
  toast: { alarm: Alarm; key: number } | null
  silence: (ids: string[]) => void
  showToast: (alarm: Alarm) => void
  dismissToast: () => void
  reset: () => void
}

let toastKey = 0

export const useAlertStore = create<AlertState>((set) => ({
  silenced: {},
  toast: null,
  silence: (ids) =>
    set((state) => ({
      silenced: { ...state.silenced, ...Object.fromEntries(ids.map((id) => [id, true as const])) },
    })),
  showToast: (alarm) => set({ toast: { alarm, key: ++toastKey } }),
  dismissToast: () => set({ toast: null }),
  reset: () => set({ silenced: {}, toast: null }),
}))
