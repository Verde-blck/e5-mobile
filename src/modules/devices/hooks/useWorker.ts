import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignWorker, removeWorker } from '../api/worker.api'
import type { Worker } from '../types'

/** Assigning or removing a worker changes what every helmet screen shows, so they all reload. */
export function useAssignWorker(deviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (worker: Worker) => assignWorker(deviceId, worker), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }) })
}

export function useRemoveWorker(deviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: () => removeWorker(deviceId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }) })
}
