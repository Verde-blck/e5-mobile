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
  selectAlarm: (id: string | null) => void
  selectHelmet: (id: string | null) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  alarmId: null,
  helmetId: null,
  selectAlarm: (alarmId) => set({ alarmId }),
  selectHelmet: (helmetId) => set({ helmetId }),
  clear: () => set({ alarmId: null, helmetId: null }),
}))
