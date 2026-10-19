import { ScrollView, View } from 'react-native'
import { Stack } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { formatCoord, formatDateTime } from '@/shared/lib/format'
import { BatteryChip } from '@/modules/devices/components/BatteryChip'
import { PresenceBadge } from '@/modules/devices/components/PresenceBadge'
import { SignalBars } from '@/modules/devices/components/SignalBars'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import {
  describeFix,
  formatMeters,
  gpsLevelLabel,
  networkLabel,
  simLabel,
} from '@/modules/devices/lib/location'
import { openInMaps } from '@/modules/devices/lib/maps'
import { ConnectionSection } from '@/modules/settings/components/ConnectionSection'
import { HelmetSettingsSection } from '@/modules/settings/components/HelmetSettingsSection'
import { lastSeenLabel } from '@/modules/devices/lib/presence'

const yesNo = (v: boolean | undefined) => (v === undefined ? '—' : v ? 'Yes' : 'No')

/**
 * One helmet in full. Its own screen on a phone or portrait tablet; the right-hand
 * pane of the Monitoring tab on a wide screen (`embedded`).
 */
export function HelmetDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { devices, now, isLoading, isError, refetch } = useDeviceViews()
  const device = devices.find((d) => d.id === id)

  if (isLoading) {
    return (
      <Screen top={false}>
        <LoadingState />
      </Screen>
    )
  }

  if (!device) {
    return (
      <Screen top={false}>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <EmptyState
            icon="help-circle"
            title="Helmet not found"
            hint="It may have been removed, this link is out of date, or your account isn't allowed to see it."
          />
        )}
      </Screen>
    )
  }

  const t = device.telemetry
  const hasLocation = t.lat !== undefined && t.lng !== undefined
  const fix = describeFix(t)
  const gps = gpsLevelLabel(t.gpsLevel)
  const network = networkLabel(t.networkType)
  const gas = t.gas ?? []
  const showSim =
    t.simStatus !== undefined || t.simDataUsedMb !== undefined || t.simPhoneNumber !== undefined

  return (
    <Screen top={false}>
      {embedded ? null : <Stack.Screen options={{ title: device.name }} />}
      <ScrollView contentContainerClassName="px-4 pb-10 pt-2">
        <Container>
        <Card className="mb-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-display-bold text-xl" numberOfLines={2}>
                {device.name}
              </Text>
              <Text className="mt-1 font-mono text-xs text-slate-500">{device.id}</Text>
            </View>
            <PresenceBadge presence={device.presence} />
          </View>
          <Text className="mt-3 text-sm text-slate-500">
            Last seen {lastSeenLabel(device.lastSeenAt, now)}
            {device.lastSeenAt ? ` · ${formatDateTime(device.lastSeenAt)}` : ''}
          </Text>
        </Card>

        <SectionTitle>Status</SectionTitle>
        <Card className="mb-5 py-1">
          <View className="flex-row items-center justify-between border-b border-slate-100 py-2.5">
            <Text className="text-sm text-slate-500">Battery</Text>
            <BatteryChip percent={t.batteryPercent} />
          </View>
          <Row label="Worn" value={yesNo(t.isWorn)} />
          <View className="flex-row items-center justify-between border-b border-slate-100 py-2.5">
            <Text className="text-sm text-slate-500">Signal</Text>
            <SignalBars level={t.signalStrength} />
          </View>
          {network ? <Row label="Connection" value={network} /> : null}
          <Row label="Registration" value={device.active ? 'Active' : 'Deactivated'} last />
        </Card>

        <SectionTitle>Last known location</SectionTitle>
        <Card className="mb-5">
          {hasLocation ? (
            <>
              {fix?.approximate ? (
                <View className="mb-3 rounded-xl bg-amber-50 p-3">
                  <Text className="text-sm leading-5 text-amber-900">
                    Approximate location.{' '}
                    {t.accuracyMeters !== undefined
                      ? `The helmet could be up to ${formatMeters(t.accuracyMeters)} m from this point. `
                      : ''}
                    It has no GPS fix, which is normal indoors.
                  </Text>
                </View>
              ) : null}
              <Row label="Latitude" value={formatCoord(t.lat)} mono />
              <Row label="Longitude" value={formatCoord(t.lng)} mono last={!fix && !gps} />
              {fix ? <Row label="Source" value={fix.label} last={!gps} /> : null}
              {gps ? <Row label="GPS signal" value={gps} last /> : null}
              <Button
                title="Open in Maps"
                variant="secondary"
                icon="map-pin"
                className="mt-3"
                onPress={() => openInMaps(t.lat!, t.lng!, device.name)}
              />
            </>
          ) : (
            <Text className="py-2 text-sm text-slate-500">
              This helmet hasn't reported a position yet.
            </Text>
          )}
        </Card>

        {showSim ? (
          <>
            <SectionTitle>SIM</SectionTitle>
            <Card className="mb-5 py-1">
              <Row label="Status" value={simLabel(t.simStatus)} last={!t.simPhoneNumber && t.simDataUsedMb === undefined} />
              {t.simPhoneNumber ? (
                <Row label="Number" value={t.simPhoneNumber} mono last={t.simDataUsedMb === undefined} />
              ) : null}
              {t.simDataUsedMb !== undefined ? (
                <Row label="Data used this month" value={`${t.simDataUsedMb.toFixed(1)} MB`} last />
              ) : null}
            </Card>
          </>
        ) : null}

        <ConnectionSection device={device} />

        <SectionTitle>Gas readings</SectionTitle>
        <Card className="py-1">
          {gas.length === 0 ? (
            <Text className="py-3 text-sm text-slate-500">
              No gas reading. A sensor that isn't fitted is left out rather than shown as zero.
            </Text>
          ) : (
            <>
              {gas.map((reading, index) => (
                <View
                  key={reading.gas}
                  className={cn(
                    'flex-row items-center justify-between py-2.5',
                    index < gas.length - 1 && 'border-b border-slate-100'
                  )}
                >
                  <Text className="font-sans-medium text-sm">{reading.gas}</Text>
                  <Text className="font-mono-medium text-sm tracking-wide">{reading.value}</Text>
                </View>
              ))}
              <Text className="border-t border-slate-100 py-2.5 text-xs text-slate-400">
                Taken {lastSeenLabel(t.gasAt, now)}
              </Text>
            </>
          )}
        </Card>

        <View className="mt-5" />
        <HelmetSettingsSection id={device.id} />
        </Container>
      </ScrollView>
    </Screen>
  )
}
