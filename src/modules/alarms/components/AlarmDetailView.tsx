import { useEffect } from 'react'
import { ScrollView, View } from 'react-native'
import { Stack } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { confirmAction } from '@/shared/lib/confirm'
import { formatCoord, formatDateTime } from '@/shared/lib/format'
import { useCan } from '@/shared/lib/permissions'
import { missingPermission } from '@/shared/lib/errors'
import { Container } from '@/shared/components/Container'
import { openHelmet } from '@/modules/devices/components/DeviceCard'
import { openInMaps } from '@/modules/devices/lib/maps'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { useDeviceNames } from '@/modules/devices/hooks/useDevices'
import { ALARM_ICONS, alarmTone } from '@/modules/alarms/components/alarm-style'
import { PhotoStrip, VideoList } from '@/modules/alarms/components/Footage'
import { FOOTAGE_UPLOAD_WINDOW_MS, expectsFootage, videoStatus } from '@/modules/alarms/footage'
import { useAlarmDetail, useAlarms, useResolveAlarm } from '@/modules/alarms/hooks/useAlarms'
import { useAlertStore } from '@/modules/alarms/store/alertStore'
import { alarmLabel, type Alarm } from '@/modules/alarms/types'

function Note({ children, tone = 'slate' }: { children: string; tone?: 'slate' | 'amber' }) {
  return (
    <Text
      className={cn(
        'rounded-xl p-3 text-sm leading-5',
        tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'
      )}
    >
      {children}
    </Text>
  )
}

/**
 * One alarm in full. Used as its own screen on a phone or portrait tablet, and in
 * the right-hand pane on a wide screen (`embedded`, where the screen's header isn't ours to set).
 */
export function AlarmDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const { alarms, now, isLoading } = useAlarms()
  const detail = useAlarmDetail(id)
  const names = useDeviceNames()
  const canResolve = useCan('alarms:write')
  const resolve = useResolveAlarm()
  const silence = useAlertStore((s) => s.silence)

  // Opening an alarm is acknowledging it: that's what stops the siren.
  useEffect(() => {
    if (id) silence([id])
  }, [id, silence])

  // The live list is the source of truth for status (the stream keeps it
  // current); the detail request is the fallback for an alarm not in it.
  const fromList = alarms.find((a) => a.id === id)
  const alarm: Alarm | undefined =
    fromList ??
    (detail.data
      ? {
          ...detail.data.alarm,
          deviceName: names.get(detail.data.alarm.deviceId) ?? detail.data.alarm.deviceName,
        }
      : undefined)

  if (!alarm) {
    return (
      <Screen top={false}>
        {isLoading || detail.isLoading ? (
          <LoadingState />
        ) : (
          <EmptyState
            icon="help-circle"
            title="Alarm not found"
            hint="It may have been removed, or this link is out of date."
          />
        )}
      </Screen>
    )
  }

  const tone = alarmTone(alarm)
  const label = alarmLabel(alarm.type)
  const active = alarm.status === 'active'
  const hasLocation = alarm.lat !== undefined && alarm.lng !== undefined

  function toggle() {
    confirmAction({
      title: active ? 'Resolve this alarm?' : 'Reopen this alarm?',
      message: active
        ? 'This clears the alert on every phone and dashboard.'
        : 'It will show as active again on every phone and dashboard.',
      confirmLabel: active ? 'Resolve' : 'Reopen',
      onConfirm: () => resolve.mutate({ id: alarm!.id, resolved: active }),
    })
  }

  const footage = detail.data
  const status = footage ? videoStatus({ ...footage, alarm }, now) : 'none'
  const tooOldForPhoto = now - alarm.raisedAt > FOOTAGE_UPLOAD_WINDOW_MS

  return (
    <Screen top={false}>
      {embedded ? null : <Stack.Screen options={{ title: label }} />}
      <ScrollView contentContainerClassName="px-4 pb-10 pt-2">
        <Container>
        <Card className="mb-5">
          <View className="flex-row items-center gap-3">
            <View className={cn('h-12 w-12 items-center justify-center rounded-full', tone.bg)}>
              <Feather name={ALARM_ICONS[alarm.type]} size={22} color={tone.icon} />
            </View>
            <View className="flex-1">
              <Text className="font-display-bold text-xl" numberOfLines={2}>
                {label}
              </Text>
              <Text className="mt-0.5 text-sm text-slate-600">{alarm.deviceName}</Text>
            </View>
            <View className={cn('rounded-full px-2.5 py-1', tone.pill)}>
              <Text className={cn('font-sans-medium text-xs', tone.pillText)}>{tone.label}</Text>
            </View>
          </View>
          <Text className="mt-4 text-sm text-slate-500">
            Raised {lastSeenLabel(alarm.raisedAt, now)} · {formatDateTime(alarm.raisedAt)}
          </Text>
          {alarm.status === 'resolved' && alarm.resolvedAt ? (
            <Text className="mt-1 text-sm text-slate-500">
              Resolved {lastSeenLabel(alarm.resolvedAt, now)}
              {alarm.resolvedBy ? ` by ${alarm.resolvedBy}` : ''}
            </Text>
          ) : null}

          <View className="mt-4 gap-2">
            {canResolve ? (
              <Button
                title={active ? 'Resolve alarm' : 'Reopen alarm'}
                variant={active ? 'primary' : 'secondary'}
                icon={active ? 'check-circle' : 'rotate-ccw'}
                loading={resolve.isPending}
                onPress={toggle}
              />
            ) : null}
            <Button
              title="View helmet"
              variant="secondary"
              icon="shield"
              onPress={() => openHelmet(alarm.deviceId)}
            />
          </View>
          {resolve.isError ? (
            <Text className="mt-2 text-sm text-red-600">
              That didn't go through. The alarm has been put back as it was.
            </Text>
          ) : null}
        </Card>

        <SectionTitle>Where it happened</SectionTitle>
        <Card className="mb-5">
          {hasLocation ? (
            <>
              <Row label="Latitude" value={formatCoord(alarm.lat)} mono />
              <Row label="Longitude" value={formatCoord(alarm.lng)} mono last />
              <Button
                title="Open in Maps"
                variant="secondary"
                icon="map-pin"
                className="mt-3"
                onPress={() => openInMaps(alarm.lat!, alarm.lng!, `${label} · ${alarm.deviceName}`)}
              />
            </>
          ) : (
            <Text className="py-2 text-sm text-slate-500">
              The helmet sent no position with this alarm.
            </Text>
          )}
        </Card>

        <SectionTitle>Photos</SectionTitle>
        <Card className="mb-5">
          {detail.isForbidden ? (
            <Note tone="amber">
              {`Your role can't view alarm footage${
                missingPermission(detail.error) ? ` (needs ${missingPermission(detail.error)})` : ''
              }.`}
            </Note>
          ) : detail.isLoading ? (
            <Text className="text-sm text-slate-500">Loading…</Text>
          ) : detail.isError ? (
            <Note tone="amber">Couldn't load the footage. Pull back and open the alarm again to retry.</Note>
          ) : footage && footage.photos.length > 0 ? (
            <PhotoStrip photos={footage.photos} />
          ) : expectsFootage(alarm.type) && !tooOldForPhoto ? (
            <Note>The helmet takes a photo about 5 seconds after a serious alarm and sends it within about 20 seconds.</Note>
          ) : (
            <Note>No photo was captured for this alarm.</Note>
          )}
        </Card>

        <SectionTitle>Video</SectionTitle>
        <Card>
          {detail.isForbidden || detail.isError || detail.isLoading ? (
            <Text className="text-sm text-slate-500">—</Text>
          ) : status === 'ready' && footage ? (
            <VideoList videos={footage.videos} />
          ) : status === 'uploading' ? (
            <Note>
              Footage uploading… The helmet sends its clips about 35 minutes after an alarm, longer
              on a weak connection. This page checks every 30 seconds.
            </Note>
          ) : alarm.type === 'sos-button' ? (
            <Note>Recording of SOS-button calls isn't available yet.</Note>
          ) : expectsFootage(alarm.type) ? (
            <Note>No video was linked to this alarm.</Note>
          ) : (
            <Note>This kind of alarm doesn't record video.</Note>
          )}
        </Card>
        </Container>
      </ScrollView>
    </Screen>
  )
}
