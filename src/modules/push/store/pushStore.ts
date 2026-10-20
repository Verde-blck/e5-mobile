import { create } from 'zustand'
import type { PushStatus } from '../types'

interface PushState {
  status: PushStatus
  setStatus: (status: PushStatus) => void
}

export const usePushStore = create<PushState>((set) => ({
  status: 'off',
  setStatus: (status) => set({ status }),
}))
