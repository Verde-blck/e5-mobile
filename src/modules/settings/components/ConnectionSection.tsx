import { useState } from 'react'
import { View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/components/Button'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { Text } from '@/shared/components/Text'
import { confirmAction } from '@/shared/lib/confirm'
import { useCan } from '@/shared/lib/permissions'
import { simLabel } from '@/modules/devices/lib/location'
import type { DeviceView } from '@/modules/devices/types'
import { isNoSim, noSimMessage, switchToMobileData, switchToWifi } from '../api/settings.api'
import { describeSettingsError } from '../lib/errorText'

// Both directions are confirmed first: a helmet switched to a SIM with no data
// drops off until someone can get it back onto Wi-Fi (USB or a known hotspot).
export function ConnectionSection({ device }: { device: DeviceView }) {
  const canSwitch = useCan('wifi:write')
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!canSwitch) return null

  const network = device.telemetry.networkType
  const onWifi = network === 'wifi'
  const onMobile = network === '4g'

  function finish(delivered: boolean) {
    setNote(
      delivered
        ? 'Sent to the helmet. It will reconnect on the new network, and this page updates when it reports in.'
        : "The helmet didn't receive that. It looks to be offline, so nothing has changed."
    )
    void queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  async function toMobile(force: boolean) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      finish((await switchToMobileData(device.id, force)).delivered)
    } catch (e) {
      if (!force && isNoSim(e)) {
        confirmAction({
          title: 'No SIM reported',
          message: `${noSimMessage(e)} Switching anyway can leave the helmet offline until it can reach Wi-Fi again.`,
          confirmLabel: 'Switch anyway',
          destructive: true,
          onConfirm: () => void toMobile(true),
        })
      } else {
        setError(describeSettingsError(e))
      }
    } finally {
      setBusy(false)
    }
  }

  async function toWifi() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      finish((await switchToWifi(device.id)).delivered)
    } catch (e) {
      setError(describeSettingsError(e))
    } finally {
      setBusy(false)
    }
  }

  function askMobile() {
    confirmAction({
      title: `Switch ${device.name} to mobile data?`,
      message:
        'The helmet will drop Wi-Fi and reconnect over 4G. If its SIM has no data it stays offline until it can reach Wi-Fi again, by USB or a known hotspot.',
      confirmLabel: 'Switch',
      destructive: true,
      onConfirm: () => void toMobile(false),
    })
  }

  function askWifi() {
    confirmAction({
      title: `Switch ${device.name} back to Wi-Fi?`,
      message: 'The helmet will drop mobile data and reconnect to a Wi-Fi network it knows, including the site Wi-Fi.',
      confirmLabel: 'Switch',
      onConfirm: () => void toWifi(),
    })
  }

  return (
    <>
      <SectionTitle>Connection</SectionTitle>
      <Card className="mb-5 py-1">
        <Row label="Connected over" value={onWifi ? 'Wi-Fi' : onMobile ? 'Mobile data (4G)' : '—'} />
        <Row label="SIM" value={simLabel(device.telemetry.simStatus)} last />
        <View className="gap-2 pb-3 pt-2">
          {!onMobile ? (
            <Button title="Switch to mobile data" variant="secondary" icon="smartphone" loading={busy} onPress={askMobile} />
          ) : null}
          {!onWifi ? (
            <Button title="Switch to Wi-Fi" variant="secondary" icon="wifi" loading={busy} onPress={askWifi} />
          ) : null}
          {note ? <Text className="rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-900">{note}</Text> : null}
          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        </View>
      </Card>
    </>
  )
}
