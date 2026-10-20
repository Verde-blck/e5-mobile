import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useCan } from '@/shared/lib/permissions'
import { useCreateGroup, useGroups } from '@/modules/users/hooks/useAdmins'

/** The groups to choose from, with search, and Create for anyone allowed to manage groups. */
export function GroupPicker({ selectedId, onSelect }: { selectedId: number | null; onSelect: (id: number) => void }) {
  const { groups, isLoading } = useGroups()
  const canCreate = useCan('groups:write')
  const create = useCreateGroup()
  const [search, setSearch] = useState('')
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle ? groups.filter((g) => g.name.toLowerCase().includes(needle)) : groups
  }, [groups, search])

  return (
    <View>
      <TextField label="Search groups" value={search} onChangeText={setSearch} placeholder="Group name" autoCapitalize="none" autoCorrect={false} />
      {canCreate && !naming ? (
        <Pressable hitSlop={8} className="mt-2 self-start" onPress={() => { setNaming(true); setDraft('') }}>
          <Text className="font-sans-semibold text-sm text-brand-primary">Create a group</Text>
        </Pressable>
      ) : null}
      {naming ? (
        <View className="mt-3 gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <TextField label="New group name" value={draft} onChangeText={setDraft} />
          <View className="flex-row gap-2">
            <Button title="Confirm" className="h-10 flex-1" loading={create.isPending} disabled={!draft.trim()} onPress={() => create.mutate(draft.trim(), { onSuccess: (g) => { setNaming(false); onSelect(g.id) } })} />
            <Button title="Cancel" variant="secondary" className="h-10 flex-1" onPress={() => setNaming(false)} />
          </View>
        </View>
      ) : null}

      <View className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? <Text className="px-3 py-3 text-sm text-slate-500">Loading groups…</Text> : null}
        {!isLoading && shown.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">No groups yet.</Text> : null}
        {shown.map((g, i) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityState={{ selected: g.id === selectedId }}
            aria-pressed={g.id === selectedId}
            onPress={() => onSelect(g.id)}
            className={cn('px-3 py-3 active:bg-slate-50', i > 0 && 'border-t border-slate-100', g.id === selectedId && 'bg-brand-tint')}
          >
            <Text className="font-sans-medium text-sm" numberOfLines={1}>{g.name}</Text>
            <Text className="text-[11px] text-slate-400">Created by {g.createdBy ?? '—'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
