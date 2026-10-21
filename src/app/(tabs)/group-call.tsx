import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { openCall } from '@/modules/calls/components/CallButton'
import { liveAvailable } from '@/modules/live/api/live.api'

const DOT = { online: 'bg-emerald-500', degraded: 'bg-amber-400', offline: 'bg-slate-300' } as const
const STATE = { online: 'Online', degraded: 'Weak signal', offline: 'Offline' } as const

/**
 * Where a helmet is called: choose one, then an audio call or a video call. (Live calls with several helmets at once
 * aren't available yet.) A voice message is sent from a helmet's own screen, not from here.
 */
function GroupCallScreen() {
  const { devices } = useDeviceViews()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const shown = needle ? devices.filter((d) => d.name.toLowerCase().includes(needle) || d.id.toLowerCase().includes(needle)) : devices
  const selected = devices.find((d) => d.id === selectedId)

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-0">
        <Container max={640}>
          <PageTitle title="Group call" padded={false} />
          <Text className="mb-4 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
            Choose a helmet, then an audio call or a video call. Live calls with several helmets at once aren't available yet.
          </Text>

          <TextField label="Find a helmet" value={search} onChangeText={setSearch} placeholder="Name or number" autoCapitalize="none" autoCorrect={false} />
          <View className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {devices.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">Loading fleet…</Text> : null}
            {devices.length > 0 && shown.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">No helmets match that search.</Text> : null}
            {shown.map((d, i) => {
              const on = d.id === selectedId
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityLabel={d.name}
                  accessibilityState={{ selected: on, disabled: !d.active }}
                  aria-pressed={on}
                  disabled={!d.active}
                  onPress={() => setSelectedId(d.id)}
                  className={cn('min-h-12 flex-row items-center gap-3 px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100', on && 'bg-brand-tint')}
                  style={{ opacity: d.active ? 1 : 0.45 }}
                >
                  <View className={cn('h-2 w-2 rounded-full', DOT[d.presence])} />
                  <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{d.name}</Text>
                  <Text className="text-xs text-slate-400">{d.active ? STATE[d.presence] : 'Deactivated'}</Text>
                </Pressable>
              )
            })}
          </View>

          {selected ? (
            <View className="mt-4 gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <Text className="font-sans-semibold text-base">Call {selected.name}</Text>
              {selected.presence === 'offline' ? (
                <Text className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  This helmet looks offline. A call isn't queued, so it won't ring later; it only connects if the helmet is online when you start.
                </Text>
              ) : null}
              <Button title="Audio call" icon="phone" onPress={() => openCall(selected.id, false)} />
              <Button title="Video call" icon="video" variant="secondary" onPress={() => openCall(selected.id, true)} />
              <Text className="text-xs leading-5 text-slate-500">A video call also shows the helmet's wearer your camera, and asks the tablet for camera access the first time.</Text>
            </View>
          ) : (
            <Text className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">Select a helmet to call it.</Text>
          )}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function GroupCallRoute() {
  return (
    <RequirePermission permission="live:write" fallback="/more">
      {liveAvailable() ? (
        <GroupCallScreen />
      ) : (
        <Screen>
          <PageTitle title="Group call" />
          <Text className="mx-4 rounded-xl bg-slate-100 p-4 text-sm leading-5 text-slate-600">Calls aren't switched on in this build yet. See "What's switched on" in More.</Text>
        </Screen>
      )}
    </RequirePermission>
  )
}
