import { clearSession } from '@/modules/auth/api/auth.api'
import { alarmCursor, streamStatus } from '@/modules/alarms/lib/alarmStream'
import { useAlertStore } from '@/modules/alarms/store/alertStore'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { useAuthStore } from '@/shared/store/authStore'
import { queryClient } from './query-client'

// The user goes first so protected screens unmount before the cache they read from is emptied.
export async function endSession(): Promise<void> {
  useAuthStore.getState().clearUser()
  await queryClient.cancelQueries()
  queryClient.clear()
  // Another account signing in next must not inherit this one's place in the alarm stream, or its silenced sirens.
  alarmCursor.reset()
  streamStatus.set('down')
  useAlertStore.getState().reset()
  useSelectionStore.getState().clear()
  await clearSession()
}
