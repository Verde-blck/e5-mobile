import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Card, SectionTitle } from '@/shared/components/Card'
import { AlertsBanner } from '@/modules/push/components/AlertsBanner'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { tileWidthFor } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import type { IconName } from '@/shared/constants/modules'
import { openHelmet } from '@/modules/devices/components/DeviceCard'
import { LOW_BATTERY_PERCENT } from '@/modules/devices/components/BatteryChip'
import { PresenceBadge } from '@/modules/devices/components/PresenceBadge'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { useDeviceViews, useFleetSummary } from '@/modules/devices/hooks/useDevices'
import type { DeviceView } from '@/modules/devices/types'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Tile({
  icon,
  label,
  value,
  tone,
  width,
}: {
  icon: IconName
  label: string
  value: number | string
  tone: 'brand' | 'green' | 'slate' | 'red'
  /** The tile's width once the row has been measured; until then it just shares the row. */
  width?: number
}) {
  const brandColour = useBrandColours().primary
  const TONES = {
    brand: { bg: 'bg-brand-tint', color: brandColour },
    green: { bg: 'bg-emerald-50', color: '#059669' },
    slate: { bg: 'bg-slate-100', color: '#64748B' },
    red: { bg: 'bg-red-50', color: '#DC2626' },
  }[tone]
  return (
    <View style={width ? { width } : { flexGrow: 1, flexBasis: 130 }}>
    <Card>
      <View className={cn('mb-3 h-9 w-9 items-center justify-center rounded-full', TONES.bg)}>
        <Feather name={icon} size={18} color={TONES.color} />
      </View>
      <Text className="font-display-bold text-3xl">{value}</Text>
      <Text className="mt-0.5 text-sm text-slate-500">{label}</Text>
    </Card>
    </View>
  )
}

/** Why a helmet is on the "needs attention" list — can be more than one reason. */
function reasonsFor(d: DeviceView, now: number): string[] {
  const reasons: string[] = []
  if (d.presence === 'offline') {
    reasons.push(d.lastSeenAt ? `Offline, last seen ${lastSeenLabel(d.lastSeenAt, now)}` : 'Never connected')
  }
  const battery = d.telemetry.batteryPercent
  if (battery !== undefined && battery < LOW_BATTERY_PERCENT) {
    reasons.push(`Battery ${Math.round(battery)}%`)
  }
  return reasons
}

function DashboardScreen() {
  const brand = useBrandColours()
  const user = useAuthStore((s) => s.user)
  const fleet = useDeviceViews()
  const summary = useFleetSummary()
  // Four tiles in a row when they have room, otherwise an even two by two: never three and an orphan, which is what
  // a flowing row gives beside a side rail on a tablet in portrait.
  const [rowWidth, setRowWidth] = useState(0)
  const tileWidth = tileWidthFor(rowWidth)

  const attention = fleet.devices
    // A deactivated helmet being offline is expected, not something to chase.
    .filter((d) => d.active)
    .map((d) => ({ device: d, reasons: reasonsFor(d, fleet.now) }))
    .filter((x) => x.reasons.length > 0)
    .slice(0, 6)

  const refreshing = fleet.isRefetching || summary.isRefetching
  const refresh = () => {
    void fleet.refetch()
    void summary.refetch()
  }

  if (fleet.isLoading && summary.isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading your fleet…" />
      </Screen>
    )
  }

  if (fleet.isError && summary.isError) {
    return (
      <Screen>
        <ErrorState onRetry={refresh} />
      </Screen>
    )
  }

  const s = summary.data

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-8 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={brand.primary}
            colors={[brand.primary]}
          />
        }
      >
        <Container max={960}>
        <AlertsBanner />
        <Text className="text-sm text-slate-500">{greeting()}</Text>
        <Text className="mb-5 font-display-bold text-2xl" numberOfLines={1}>
          {user?.name ?? 'Welcome'}
        </Text>

        <View className="mb-6 flex-row flex-wrap gap-3" onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
          <Tile width={tileWidth} icon="shield" label="Helmets" value={s?.total ?? '—'} tone="brand" />
          <Tile width={tileWidth} icon="wifi" label="Online" value={s?.online ?? '—'} tone="green" />
          <Tile width={tileWidth} icon="wifi-off" label="Offline" value={s?.offline ?? '—'} tone="slate" />
          <Tile
            width={tileWidth}
            icon="bell"
            label="Alarms, last 24 h"
            value={s?.alarms24h ?? '—'}
            tone={s && s.alarms24h > 0 ? 'red' : 'slate'}
          />
        </View>

        <SectionTitle>Needs attention</SectionTitle>
        {attention.length === 0 ? (
          <Card className="items-center py-8">
            <Feather name="check-circle" size={28} color="#059669" />
            <Text className="mt-2 font-sans-semibold">All clear</Text>
            <Text className="mt-0.5 text-center text-sm text-slate-500">
              No active helmets are offline or low on battery.
            </Text>
          </Card>
        ) : (
          attention.map(({ device, reasons }) => (
            <Pressable
              key={device.id}
              accessibilityRole="button"
              onPress={() => openHelmet(device.id)}
              className="mb-2.5 flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
              <View className="flex-1">
                <Text className="font-sans-semibold" numberOfLines={1}>
                  {device.name}
                </Text>
                {reasons.map((reason) => (
                  <Text key={reason} className="mt-0.5 text-sm text-slate-500">
                    {reason}
                  </Text>
                ))}
              </View>
              <PresenceBadge presence={device.presence} />
            </Pressable>
          ))
        )}

        {s ? (
          <Text className="mt-4 text-center text-xs text-slate-400">
            {s.active} active · {s.inactive} deactivated · updates every 10 seconds
          </Text>
        ) : null}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function DashboardRoute() {
  // A restricted account lands on its helmet list rather than a dead-end.
  const canDevices = useCan('devices:read')
  return (
    <RequirePermission permission="dashboard:read" fallback={canDevices ? '/devices' : '/more'}>
      <DashboardScreen />
    </RequirePermission>
  )
}
