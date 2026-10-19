import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import Feather from '@expo/vector-icons/Feather'
import { env } from '@/config/env'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import type { IconName } from '@/shared/constants/modules'
import { confirmAction } from '@/shared/lib/confirm'
import { endSession } from '@/shared/lib/session'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import { simulateAlarm } from '@/modules/alarms/api/alarms.mock'

function MenuRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName
  label: string
  hint?: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-tint">
        <Feather name={icon} size={18} color="#0A6659" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-medium">{label}</Text>
        {hint ? <Text className="mt-0.5 text-xs text-slate-500">{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color="#94A3B8" />
    </Pressable>
  )
}

export default function MoreScreen() {
  const user = useAuthStore((s) => s.user)
  const canWifi = useCan('wifi:read')
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase()

  function signOut() {
    confirmAction({
      title: 'Sign out?',
      message: 'You will need your username and password to sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
      onConfirm: () => void endSession(),
    })
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <Container max={640}>
        <Text className="mb-4 font-display-bold text-2xl">More</Text>

        <Card className="mb-6 flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-primary">
            <Text className="font-display-bold text-lg text-white">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-sans-semibold text-base" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={1}>
              {user?.username} · {user?.role}
            </Text>
            {user?.deviceIds && user.deviceIds.length > 0 ? (
              <Text className="mt-0.5 text-xs text-slate-500">
                Limited to {user.deviceIds.length} {user.deviceIds.length === 1 ? 'helmet' : 'helmets'}
              </Text>
            ) : null}
          </View>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <MenuRow
          icon="shield"
          label="Account security"
          hint="Two-step verification"
          onPress={() => router.push('/security')}
        />
        {canWifi ? (
          <View className="mt-3">
            <MenuRow
              icon="wifi"
              label="Site Wi-Fi"
              hint="The network every helmet joins"
              onPress={() => router.push('/wifi')}
            />
          </View>
        ) : null}

        <SectionTitle className="mt-6">About</SectionTitle>
        <Card className="py-1">
          <Row label="App version" value={Constants.expoConfig?.version ?? '—'} />
          <Row label="Data source" value={env.useMocks ? 'Sample data' : 'Live backend'} last />
        </Card>

        {env.useMocks ? (
          <>
            <SectionTitle className="mt-6">Sample data tools</SectionTitle>
            <Card className="gap-2">
              <Text className="mb-1 text-xs leading-5 text-slate-500">
                Fires a fake alarm through the same path a real one takes.
              </Text>
              <Button
                title="SOS button pressed"
                variant="danger"
                icon="alert-octagon"
                onPress={() => simulateAlarm('manual_sos_button')}
              />
              <Button
                title="Fall detected"
                variant="secondary"
                icon="trending-down"
                onPress={() => simulateAlarm('4', '866652022958103')}
              />
              <Button
                title="Helmet removed"
                variant="secondary"
                icon="user-x"
                onPress={() => simulateAlarm('1', '866652022956412')}
              />
            </Card>
          </>
        ) : null}

        <Button title="Sign out" variant="secondary" icon="log-out" className="mt-8" onPress={signOut} />
        </Container>
      </ScrollView>
    </Screen>
  )
}
