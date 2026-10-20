import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '@/config/env'
import { isForbidden } from '@/shared/lib/errors'
import { useAuthStore } from '@/shared/store/authStore'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { fetchMessages, sendVoiceMessage } from '../api/messages.api'

const key = (deviceId: string) => ['messages', deviceId] as const

/**
 * A helmet's conversation. Re-read every few seconds while the screen is open (and the app is in front), which
 * also swaps in fresh links: the recordings' links expire after about an hour.
 */
export function useMessages(deviceId: string) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const q = useQuery({
    queryKey: key(deviceId),
    queryFn: () => fetchMessages(deviceId),
    enabled: signedIn && !!deviceId,
    refetchInterval: env.pollIntervalMs,
    retry: (count, error) => !isForbidden(error) && count < 1,
  })
  return { messages: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, forbidden: isForbidden(q.error) }
}

export function useSendVoiceMessage(deviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (audio: RecordedAudio) => sendVoiceMessage(deviceId, audio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(deviceId) }),
  })
}
