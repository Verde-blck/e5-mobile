import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { confirmAction } from '@/shared/lib/confirm'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { describeSettingsError } from '@/modules/settings/lib/errorText'
import { useRemoveSiteWifi, useSaveSiteWifi, useSiteWifi } from '@/modules/settings/hooks/useSettings'
import { validateSsid, validateWifiPassword } from '@/modules/settings/lib/validation'

function WifiScreen() {
  const canEdit = useCan('wifi:write')
  const wifi = useSiteWifi()
  const save = useSaveSiteWifi()
  const remove = useRemoveSiteWifi()

  const [editing, setEditing] = useState(false)
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ ssid?: string; password?: string }>({})
  const [note, setNote] = useState<string | null>(null)

  const current = wifi.data ?? null
  const showForm = canEdit && (editing || (!wifi.isLoading && !current))

  useEffect(() => {
    if (current) setSsid(current.ssid)
  }, [current])

  function startEdit() {
    setNote(null)
    setPassword('')
    setErrors({})
    setEditing(true)
  }

  function submit() {
    const next = { ssid: validateSsid(ssid) ?? undefined, password: validateWifiPassword(password) ?? undefined }
    setErrors(next)
    if (next.ssid || next.password) return

    const run = () =>
      save.mutate(
        { ssid, password: password || undefined },
        {
          onSuccess: () => {
            setEditing(false)
            setPassword('')
            setNote('Saved. Every helmet receives it in its start-up settings.')
          },
        }
      )

    if (!password && !current?.passwordSet) {
      confirmAction({
        title: 'Save without a password?',
        message: 'This sends helmets an open network with no password.',
        confirmLabel: 'Save anyway',
        destructive: true,
        onConfirm: run,
      })
    } else {
      run()
    }
  }

  function askRemove() {
    confirmAction({
      title: 'Remove the site Wi-Fi?',
      message: 'New helmets and restarted helmets will no longer be told to join it.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () =>
        remove.mutate(undefined, {
          onSuccess: () => {
            setEditing(false)
            setSsid('')
            setNote('Removed.')
          },
        }),
    })
  }

  return (
    <Screen top={false}>
      <ScrollView contentContainerClassName="px-4 pb-10 pt-2" keyboardShouldPersistTaps="handled">
        <Container max={640}>
          <Text className="mb-5 text-sm leading-5 text-slate-600">
            The Wi-Fi network every helmet is told to join. Each helmet receives it in its start-up settings
            and remembers it, so it can reconnect on site without anyone touching it.
          </Text>

          {wifi.isLoading ? (
            <LoadingState label="Loading…" />
          ) : isForbidden(wifi.error) ? (
            <Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your role can't view the site Wi-Fi.</Text>
          ) : wifi.isError ? (
            <ErrorState onRetry={() => void wifi.refetch()} />
          ) : (
            <>
              {current ? (
                <>
                  <SectionTitle>Current</SectionTitle>
                  <Card className="mb-5 py-1">
                    <Row label="Network name" value={current.ssid} />
                    <Row label="Password" value={current.passwordSet ? 'Set' : 'None (open network)'} last />
                  </Card>
                </>
              ) : !canEdit ? (
                <Text className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No site Wi-Fi has been set.</Text>
              ) : null}

              {note ? <Text className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-900">{note}</Text> : null}

              {showForm ? (
                <Card>
                  <TextField
                    label="Network name"
                    value={ssid}
                    onChangeText={setSsid}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errors.ssid}
                  />
                  <TextField
                    className="mt-4"
                    label={current?.passwordSet ? 'New password' : 'Password'}
                    value={password}
                    onChangeText={setPassword}
                    secret
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errors.password}
                  />
                  <Text className="mt-2 text-xs leading-5 text-slate-500">
                    {current?.passwordSet
                      ? 'Leave empty to keep the current password.'
                      : 'Leave empty for an open network with no password.'}
                  </Text>
                  <Button title="Save" className="mt-4" loading={save.isPending} onPress={submit} />
                  {current ? <Button title="Cancel" variant="ghost" className="mt-1" onPress={() => setEditing(false)} /> : null}
                  {save.isError ? <Text className="mt-3 text-sm text-red-600">{describeSettingsError(save.error)}</Text> : null}
                </Card>
              ) : canEdit && current ? (
                <View className="gap-2">
                  <Button title="Change" icon="edit-2" onPress={startEdit} />
                  <Button title="Remove site Wi-Fi" variant="secondary" loading={remove.isPending} onPress={askRemove} />
                  {remove.isError ? <Text className="text-sm text-red-600">{describeSettingsError(remove.error)}</Text> : null}
                </View>
              ) : current ? (
                <Text className="text-xs leading-5 text-slate-500">Your role can view this but not change it.</Text>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function WifiRoute() {
  return (
    <RequirePermission permission="wifi:read" fallback="/more">
      <WifiScreen />
    </RequirePermission>
  )
}
