import { FlatList, View } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { confirmAction } from '@/shared/lib/confirm'
import { useCan } from '@/shared/lib/permissions'
import { useDeleteFence, useFences } from '../hooks/useFences'
import { FenceCard } from './FenceCard'

/** Create a fence. */
export function newFence() {
  router.push('/fence/new')
}

export function editFence(id: number) {
  router.push(`/fence/${id}`)
}

/**
 * Every fence, with edit and delete for accounts allowed to change them. Used in the Live Map's
 * side panel and as the full-screen Fences list.
 */
export function FenceListPanel({
  selectedId,
  onSelect,
  header,
}: {
  selectedId?: number | null
  onSelect?: (id: number) => void
  header?: boolean
}) {
  const { fences, isLoading, isError, refetch } = useFences()
  const canWrite = useCan('fences:write')
  const remove = useDeleteFence()

  function askDelete(id: number, name: string) {
    confirmAction({
      title: `Delete ${name}?`,
      message: 'Helmets will no longer be alarmed about it. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(id),
    })
  }

  return (
    <View className="flex-1">
      {header ? (
        <View className="flex-row items-center justify-between px-4 pb-1 pt-4">
          <Text className="font-display-bold text-xl">Fences</Text>
          {canWrite ? <Button title="New fence" icon="plus" onPress={newFence} className="h-10 px-4" /> : null}
        </View>
      ) : canWrite ? (
        <View className="px-4 pb-1 pt-3">
          <Button title="New fence" icon="plus" onPress={newFence} className="h-10" />
        </View>
      ) : null}
      <Text className="px-4 pb-2 pt-1 text-xs leading-5 text-slate-500">
        A breach raises a “Left work area” or “Entered restricted area” alarm.
      </Text>

      {isLoading ? (
        <LoadingState label="Loading fences…" />
      ) : isError ? (
        <ErrorState title="Couldn't load fences" onRetry={() => void refetch()} />
      ) : fences.length === 0 ? (
        <EmptyState icon="hexagon" title="No fences yet" hint={canWrite ? 'Draw a work area or a no-entry zone on the map.' : 'Nobody has drawn one yet.'} />
      ) : (
        <FlatList
          data={fences}
          keyExtractor={(f) => String(f.id)}
          contentContainerClassName="px-4 pb-8 pt-1"
          renderItem={({ item }) => (
            <FenceCard fence={item} selected={item.id === selectedId} onPress={onSelect ? () => onSelect(item.id) : undefined}>
              {canWrite ? (
                <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
                  <Button title="Edit" variant="secondary" icon="edit-2" className="h-10 flex-1" onPress={() => editFence(item.id)} />
                  <Button title="Delete" variant="secondary" icon="trash-2" className="h-10 flex-1" loading={remove.isPending && remove.variables === item.id} onPress={() => askDelete(item.id, item.name)} />
                </View>
              ) : null}
            </FenceCard>
          )}
        />
      )}
    </View>
  )
}
