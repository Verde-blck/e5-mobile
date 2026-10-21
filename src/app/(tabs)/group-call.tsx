import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useCan } from '@/shared/lib/permissions'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { openCall } from '@/modules/calls/components/CallButton'
import { activeGroupCall, getGroupCall, stopGroupCall } from '@/modules/live/api/groupCall.api'
import { liveAvailable } from '@/modules/live/api/live.api'
import { GROUP_CALL_MAX, callPlan, toggleChosen } from '@/modules/live/lib/groupPlan'

const DOT = { online: 'bg-emerald-500', degraded: 'bg-amber-400', offline: 'bg-slate-300' } as const
const STATE = { online: 'Online', degraded: 'Weak signal', offline: 'Offline' } as const

/**
 * A call that this tablet started and that is still running, because the app was closed or killed mid-call and could
 * not tell the helmets. They stay in call mode until told otherwise, so this offers to end it.
 */
function LeftOverCall() {
  const [call, setCall] = useState<{ id: string; helmets: number } | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      const id = await activeGroupCall.get()
      if (!id) return
      try {
        const found = await getGroupCall(id)
        if (!alive) return
        if (found) setCall({ id, helmets: found.helmets.filter((h) => h.delivered).length })
        else await activeGroupCall.set(null)
      } catch {
        /* can't tell right now: leave it for next time */
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  if (!call) return null
  return (
    <View accessibilityRole="alert" className="mb-4 gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <Text className="font-sans-semibold text-sm text-amber-900">A group call you started is still running</Text>
      <Text className="text-xs leading-5 text-amber-900">The app was closed during it, so {call.helmets === 1 ? '1 helmet is' : `${call.helmets} helmets are`} still in call mode. End it to put them back.</Text>
      <View className="flex-row gap-2">
        <Button title="End it" icon="phone-off" className="h-10 flex-1" onPress={() => void stopGroupCall(call.id).then(() => activeGroupCall.set(null)).then(() => setCall(null))} />
        <Button title="Not now" variant="secondary" className="h-10 flex-1" onPress={() => setCall(null)} />
      </View>
    </View>
  )
}

/**
 * Where helmets are called: tick one for a one-to-one call, or up to 8 to talk with all of them at once, then a video
 * call or an audio call. A voice message is sent from a helmet's own screen, not from here.
 */
function GroupCallScreen() {
  const { devices } = useDeviceViews()
  const canSingle = useCan('live:write')
  const canGroup = useCan('groupCall:write')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const shown = needle ? devices.filter((d) => d.name.toLowerCase().includes(needle) || d.id.toLowerCase().includes(needle)) : devices
  // Only helmets that are still active count: one deactivated since it was ticked can't join.
  const chosen = selected.filter((id) => devices.some((d) => d.id === id && d.active))
  const plan = callPlan(chosen, { single: canSingle, group: canGroup })
  const offline = chosen.filter((id) => devices.find((d) => d.id === id)?.presence === 'offline').length

  function start(video: boolean) {
    if (plan.kind === 'single') openCall(plan.deviceId, video)
    else if (plan.kind === 'group') router.push({ pathname: '/conference', params: { ids: plan.deviceIds.map(encodeURIComponent).join(','), video: video ? '1' : '0' } })
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-0">
        <Container max={640}>
          <PageTitle title="Group call" padded={false} />
          <LeftOverCall />
          <Text className="mb-4 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
            Choose one helmet for a call with it, or up to {GROUP_CALL_MAX} to talk with all of them at once. You'll see and hear each one.
          </Text>

          <TextField label="Find a helmet" value={search} onChangeText={setSearch} placeholder="Name or number" autoCapitalize="none" autoCorrect={false} />
          <View className="mb-2 mt-3 flex-row items-center justify-between">
            <Text className="text-sm text-slate-500">{chosen.length} selected · up to {GROUP_CALL_MAX} per call</Text>
            <View className="flex-row gap-4">
              <Pressable hitSlop={8} onPress={() => setSelected(devices.filter((d) => d.active).map((d) => d.id))}>
                <Text className="font-sans-medium text-sm text-brand-primary">Select all</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setSelected([])}>
                <Text className="font-sans-medium text-sm text-slate-600">Clear</Text>
              </Pressable>
            </View>
          </View>
          <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {devices.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">Loading fleet…</Text> : null}
            {devices.length > 0 && shown.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">No helmets match that search.</Text> : null}
            {shown.map((d, i) => {
              const on = selected.includes(d.id)
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={d.name}
                  accessibilityState={{ checked: on, disabled: !d.active }}
                  aria-checked={on}
                  disabled={!d.active}
                  onPress={() => setSelected(toggleChosen(selected, d))}
                  className={cn('min-h-12 flex-row items-center gap-3 px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100', on && 'bg-brand-tint')}
                  style={{ opacity: d.active ? 1 : 0.45 }}
                >
                  <View className={cn('h-5 w-5 items-center justify-center rounded border', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300')}>
                    {on ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <View className={cn('h-2 w-2 rounded-full', DOT[d.presence])} />
                  <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{d.name}</Text>
                  <Text className="font-mono text-xs text-slate-400">{d.id.slice(-6)}</Text>
                  <Text className="text-xs text-slate-400">{d.active ? STATE[d.presence] : 'Deactivated'}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text className="mt-2 text-xs leading-5 text-slate-500">Offline helmets can't join a call; they show as not reachable. Deactivated ones can't be chosen.</Text>

          <View className="mt-4 gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Text className="text-sm text-slate-700">
              {chosen.length >= 2 ? "Talk live with the selected helmets. You'll see and hear each one." : chosen.length === 1 ? 'Call the selected helmet.' : 'Choose the helmets to call.'}
            </Text>
            {chosen.length >= 2 ? <Text className="text-xs text-slate-500">Beta: group calls haven't been tested on several real helmets yet.</Text> : null}
            {offline > 0 ? (
              <Text className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                {offline === 1 ? '1 selected helmet looks' : `${offline} selected helmets look`} offline. A call isn't queued, so {offline === 1 ? 'it' : 'they'} won't ring later.
              </Text>
            ) : null}
            <Button title="Video call" icon="video" disabled={plan.kind === 'none'} onPress={() => start(true)} />
            <Button title="Audio call" icon="phone" variant="secondary" disabled={plan.kind === 'none'} onPress={() => start(false)} />
            {plan.kind === 'none' ? <Text className="text-xs text-amber-700">{plan.reason}</Text> : null}
            {plan.kind !== 'none' ? <Text className="text-xs leading-5 text-slate-500">A video call also shows the helmet's wearer your camera, and asks the tablet for camera access the first time.</Text> : null}
          </View>
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function GroupCallRoute() {
  return (
    <RequirePermission permission="live:write" or="groupCall:read" fallback="/more">
      {liveAvailable() ? (
        <GroupCallScreen />
      ) : (
        <Screen>
          <PageTitle title="Group call" />
          <Text className="mx-4 rounded-xl bg-slate-100 p-4 text-sm leading-5 text-slate-600">Calls aren't switched on in this build yet.</Text>
        </Screen>
      )}
    </RequirePermission>
  )
}
