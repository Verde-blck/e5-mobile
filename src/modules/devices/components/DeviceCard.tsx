import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { detailGoesInPane, isTwoPaneNow } from '@/shared/lib/layout'
import { useAuthStore } from '@/shared/store/authStore'
import { useSelectionStore } from '@/shared/store/selectionStore'
import type { DeviceView } from '../types'
import { lastSeenLabel } from '../lib/presence'
import { AlarmPill } from './AlarmPill'
import { BatteryChip } from './BatteryChip'
import { PresenceBadge } from './PresenceBadge'

export function openHelmet(id: string) {
  const canUseTab = useAuthStore.getState().user?.permissions.includes('devices:read') ?? false
  if (detailGoesInPane(isTwoPaneNow(), canUseTab)) {
    useSelectionStore.getState().selectHelmet(id)
    router.navigate('/devices')
  } else {
    router.push(`/helmet/${encodeURIComponent(id)}`)
  }
}

export function DeviceCard({
  device,
  now,
  selected,
  onOpen,
}: {
  device: DeviceView
  now: number
  selected?: boolean
  onOpen?: (id: string) => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${device.name}, ${device.presence}${device.activeAlarm ? ', active alarm' : ''}`}
      onPress={() => (onOpen ? onOpen(device.id) : openHelmet(device.id))}
      className={cn(
        'mb-3 rounded-2xl border p-4 active:bg-slate-50',
        selected ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white'
      )}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-sans-semibold text-base" numberOfLines={1}>
            {device.name}
          </Text>
          {device.named ? (
            <Text className="mt-0.5 font-mono text-xs text-slate-500" numberOfLines={1}>
              {device.id}
            </Text>
          ) : (
            <Text className="mt-0.5 text-xs text-slate-400">Not named yet</Text>
          )}
          {device.worker ? <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>Worn by {device.worker.name}</Text> : null}
        </View>
        <View className="items-end gap-1.5">
          {device.activeAlarm ? <AlarmPill severity={device.activeAlarm} /> : null}
          <PresenceBadge presence={device.presence} />
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3">
        <View className="flex-row items-center gap-4">
          <BatteryChip percent={device.telemetry.batteryPercent} />
          {device.telemetry.isWorn !== undefined ? (
            <View className="flex-row items-center gap-1">
              <Feather name="user" size={14} color="#64748B" />
              <Text className="text-xs text-slate-600">
                {device.telemetry.isWorn ? 'Worn' : 'Not worn'}
              </Text>
            </View>
          ) : null}
          {!device.active ? (
            <Text className="font-sans-medium text-xs text-amber-700">Deactivated</Text>
          ) : null}
        </View>
        <Text className="text-xs text-slate-500">{lastSeenLabel(device.lastSeenAt, now)}</Text>
      </View>
    </Pressable>
  )
}
