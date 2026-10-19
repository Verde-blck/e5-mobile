import { useState } from 'react'
import { Linking, ScrollView, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { Card } from '@/shared/components/Card'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'
import {
  confirmTwoFactorSetup,
  describeAuthError,
  disableTwoFactor,
  refreshProfile,
  startTwoFactorSetup,
  type TwoFactorSetup,
} from '@/modules/auth/api/auth.api'

/** "JBSW Y3DP EHPK 3PXP" — easier to read and type than 16 unbroken characters. */
const groupSecret = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret

export default function SecurityScreen() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const username = user?.username ?? ''
  // From the server (GET /auth/me), so this is the real state, not a guess.
  const enabled = user?.twoFactorEnabled === true

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** Re-reads the profile so the status badge reflects what the server now says. */
  async function syncProfile(expected: boolean) {
    try {
      setUser(await refreshProfile(username))
    } catch {
      // The change itself succeeded; if the re-read fails, trust it.
      if (user) setUser({ ...user, twoFactorEnabled: expected })
    }
  }

  function reset() {
    setSetup(null)
    setDisabling(false)
    setCode('')
    setError(null)
  }

  async function beginSetup() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      setSetup(await startTwoFactorSetup(username))
    } catch (e) {
      setError(describeAuthError(e, 'Could not start setup.'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup() {
    setBusy(true)
    setError(null)
    try {
      await confirmTwoFactorSetup(username, code)
      await syncProfile(true)
      reset()
      setNotice('Two-step verification is on.')
    } catch (e) {
      setError(describeAuthError(e, "That code didn't match. Check your authenticator app."))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable() {
    setBusy(true)
    setError(null)
    try {
      await disableTwoFactor(username, code)
      await syncProfile(false)
      reset()
      setNotice('Two-step verification is off.')
    } catch (e) {
      setError(describeAuthError(e, "That code didn't match. Check your authenticator app."))
    } finally {
      setBusy(false)
    }
  }

  async function openAuthenticator() {
    if (!setup) return
    try {
      await Linking.openURL(setup.otpAuthUrl)
    } catch {
      setNotice('No authenticator app found. Copy the key and add it by hand.')
    }
  }

  async function copyKey() {
    if (!setup) return
    await Clipboard.setStringAsync(setup.secret)
    setNotice('Key copied.')
  }

  const status = enabled ? 'On' : 'Off'

  return (
    <Screen top={false}>
      <ScrollView contentContainerClassName="px-4 pb-10 pt-2" keyboardShouldPersistTaps="handled">
        <Container max={640}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-sans-semibold text-base">Two-step verification</Text>
              <Text className="mt-1 text-sm leading-5 text-slate-500">
                Asks for a code from an authenticator app each time you sign in.
              </Text>
            </View>
            <View
              className={cn(
                'rounded-full px-3 py-1',
                enabled ? 'bg-emerald-50' : 'bg-slate-100'
              )}
            >
              <Text
                className={cn(
                  'font-sans-semibold text-xs',
                  enabled ? 'text-emerald-800' : 'text-slate-600'
                )}
              >
                {status}
              </Text>
            </View>
          </View>
        </Card>

        {notice ? (
          <View className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <Text className="text-sm text-emerald-900">{notice}</Text>
          </View>
        ) : null}

        {setup ? (
          <Card className="mb-4">
            <Text className="font-sans-semibold">1. Add the account to your authenticator</Text>
            <Text className="mt-1 text-sm leading-5 text-slate-500">
              You can't scan a QR code on the phone that's showing it, so open your authenticator
              app directly, or copy the key and paste it in.
            </Text>
            <View className="my-3 rounded-xl bg-slate-100 p-3">
              <Text className="text-center font-mono-medium text-base tracking-widest" selectable>
                {groupSecret(setup.secret)}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Button
                className="flex-1"
                title="Open app"
                variant="secondary"
                icon="external-link"
                onPress={() => void openAuthenticator()}
              />
              <Button
                className="flex-1"
                title="Copy key"
                variant="secondary"
                icon="copy"
                onPress={() => void copyKey()}
              />
            </View>

            <Text className="mb-3 mt-5 font-sans-semibold">2. Enter the 6-digit code it shows</Text>
            <TextField
              label="Authentication code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              mono
              placeholder="123456"
              error={error}
            />
            <Button
              title="Turn on"
              className="mt-4"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() => void confirmSetup()}
            />
            <Button title="Cancel" variant="ghost" className="mt-1" onPress={reset} />
          </Card>
        ) : disabling ? (
          <Card className="mb-4">
            <Text className="font-sans-semibold">Turn off two-step verification</Text>
            <Text className="mb-3 mt-1 text-sm leading-5 text-slate-500">
              Enter a current code to confirm it's you.
            </Text>
            <TextField
              label="Authentication code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              mono
              placeholder="123456"
              error={error}
            />
            <Button
              title="Turn off"
              variant="danger"
              className="mt-4"
              loading={busy}
              disabled={code.length !== 6}
              onPress={() => void confirmDisable()}
            />
            <Button title="Cancel" variant="ghost" className="mt-1" onPress={reset} />
          </Card>
        ) : enabled ? (
          <Button
            title="Turn off two-step verification"
            variant="secondary"
            onPress={() => {
              setNotice(null)
              setDisabling(true)
            }}
          />
        ) : (
          <>
            <Button
              title="Set up two-step verification"
              icon="shield"
              loading={busy}
              onPress={() => void beginSetup()}
            />
            {error ? <Text className="mt-2 text-sm text-red-600">{error}</Text> : null}
          </>
        )}
        </Container>
      </ScrollView>
    </Screen>
  )
}
