import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import { deleteFence, fetchFences, saveFenceWithClip } from '../api/fences.api'
import type { ClipFile } from '../lib/clip'
import type { FenceDraft } from '../types'

export function useFences() {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const canRead = useCan('fences:read')
  const query = useQuery({
    queryKey: ['fences'],
    queryFn: fetchFences,
    staleTime: 60_000,
    enabled: signedIn && canRead,
    retry: (count, error) => !isForbidden(error) && count < 1,
  })
  return {
    fences: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useSaveFence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ draft, id, clip }: { draft: FenceDraft; id?: number; clip?: ClipFile | null }) =>
      saveFenceWithClip(draft, id, clip),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['fences'] }),
  })
}

export function useDeleteFence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteFence,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['fences'] }),
  })
}
