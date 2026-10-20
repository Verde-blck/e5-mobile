import { useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { confirmAction } from '@/shared/lib/confirm'
import { useAdmins, useCreateGroup, useDeleteGroup, useGroups, useRenameGroup } from '../hooks/useAdmins'

export function GroupList({ canEdit }: { canEdit: boolean }) {
  const { groups, isLoading, isError, refetch } = useGroups()
  const { admins } = useAdmins()
  const create = useCreateGroup()
  const rename = useRenameGroup()
  const remove = useDeleteGroup()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate(trimmed, { onSuccess: () => setName('') })
  }
  function askDelete(id: number, label: string, members: number) {
    confirmAction({
      title: `Delete ${label}?`,
      message: members ? `${members} ${members === 1 ? 'administrator is' : 'administrators are'} in this group and will be left with no group.` : 'Nobody is in this group.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(id),
    })
  }

  if (isLoading) return <LoadingState label="Loading groups…" />
  if (isError) return <ErrorState title="Couldn't load groups" onRetry={() => void refetch()} />

  return (
    <View className="flex-1">
      {canEdit ? (
        <View className="gap-3 px-4 pb-2 pt-3">
          <TextField label="New group" value={name} onChangeText={setName} placeholder="Group name" onSubmitEditing={add} />
          <Button title="Add group" icon="plus" loading={create.isPending} disabled={!name.trim()} onPress={add} />
        </View>
      ) : null}
      {groups.length === 0 ? (
        <EmptyState icon="users" title="No groups yet" hint="A group is one label an administrator can belong to." />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => String(g.id)}
          contentContainerClassName="px-4 pb-10 pt-1"
          renderItem={({ item: group }) => {
            const members = admins.filter((a) => a.groupId === group.id).length
            return (
              <Card className="mb-3">
                {editing === group.id ? (
                  <View className="gap-3">
                    <TextField label="Group name" value={draft} onChangeText={setDraft} />
                    <View className="flex-row gap-2">
                      <Button title="Save" className="h-10 flex-1" loading={rename.isPending} disabled={!draft.trim()} onPress={() => rename.mutate({ id: group.id, name: draft.trim() }, { onSuccess: () => setEditing(null) })} />
                      <Button title="Cancel" variant="secondary" className="h-10 flex-1" onPress={() => setEditing(null)} />
                    </View>
                  </View>
                ) : (
                  <>
                    <Text className="font-sans-semibold text-base">{group.name}</Text>
                    <Text className="mt-0.5 text-sm text-slate-500">
                      {members} {members === 1 ? 'administrator' : 'administrators'}
                      {group.createdBy ? ` · created by ${group.createdBy}` : ''}
                    </Text>
                    {canEdit ? (
                      <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
                        <Button title="Rename" variant="secondary" icon="edit-2" className="h-10 flex-1" onPress={() => { setEditing(group.id); setDraft(group.name) }} />
                        <Button title="Delete" variant="secondary" icon="trash-2" className="h-10 flex-1" onPress={() => askDelete(group.id, group.name, members)} />
                      </View>
                    ) : null}
                  </>
                )}
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}
