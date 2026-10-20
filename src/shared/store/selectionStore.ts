import { create } from 'zustand'

/**
 * Which alarm / helmet is open in the right-hand pane on a wide screen.
 *
 * Nothing is selected until someone chooses it. Auto-selecting the first
 * alarm would be a mistake: opening an alarm acknowledges it, which silences
 * its siren, so a default selection would quietly silence the most urgent one.
 */
interface SelectionState {
  alarmId: string | null
  helmetId: string | null
  fenceId: number | null
  selectAlarm: (id: string | null) => void
  selectHelmet: (id: string | null) => void
  selectFence: (id: number | null) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  alarmId: null,
  helmetId: null,
  fenceId: null,
  selectAlarm: (alarmId) => set({ alarmId }),
  selectHelmet: (helmetId) => set({ helmetId }),
  selectFence: (fenceId) => set({ fenceId }),
  clear: () => set({ alarmId: null, helmetId: null, fenceId: null }),
}))
