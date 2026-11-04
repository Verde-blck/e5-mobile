import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import Feather from '@expo/vector-icons/Feather'
import { env } from '@/config/env'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { Card, Row, SectionTitle } from '@/shared/components/Card'
import { CompanyLogo } from '@/shared/components/Logo'
import { PageTitle } from '@/shared/components/PageTitle'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import type { IconName } from '@/shared/constants/modules'
import { confirmAction } from '@/shared/lib/confirm'
import { openPrivacyPolicy } from '@/shared/lib/privacyPolicy'
import { endSession } from '@/shared/lib/session'
import { useBrandColours, useBranding } from '@/modules/branding/hooks/useBranding'
import { useLayout } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import { simulateAlarm } from '@/modules/alarms/api/alarms.mock'
import { liveAvailable } from '@/modules/live/api/live.api'
import { AlertsCard } from '@/modules/push/components/AlertsCard'
import { unregisterThisTablet } from '@/modules/push/lib/unregister'

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
        <Feather name={icon} size={18} color={useBrandColours().primary} />
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
  const { size } = useLayout()
  const inMore = size === 'compact'
  const canWifi = useCan('wifi:read')
  const canTrack = useCan('trackPlayback:read') && inMore
  const canWall = useCan('live:read') && liveAvailable() && inMore
  const canFences = useCan('fences:read')
  const company = useBranding()
  const canPhotos = useCan('photos:read')
  const canVideos = useCan('videos:read')
  const canAdmins = useCan('users:read') && inMore
  const canGroupCall = (useCan('live:write') || useCan('groupCall:read')) && liveAvailable() && inMore
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase()

  function signOut() {
    confirmAction({
      title: 'Sign out?',
      message: 'You will need your username and password to sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
      onConfirm: () => void unregisterThisTablet().then(() => endSession()),
    })
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <Container max={640}>
        <PageTitle title="More" padded={false} />

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

        <SectionTitle>Alarm alerts</SectionTitle>
        <AlertsCard />

        <SectionTitle className="mt-6">Account</SectionTitle>
        <MenuRow
          icon="shield"
          label="Account security"
          hint="Two-step verification"
          onPress={() => router.push('/security')}
        />
        {canWall ? (
          <View className="mt-3">
            <MenuRow icon="grid" label="Live wall" hint="Watch several helmets at once" onPress={() => router.navigate('/wall')} />
          </View>
        ) : null}
        {canGroupCall ? (
          <View className="mt-3">
            <MenuRow icon="radio" label="Group call" hint="Call one helmet, or several at once" onPress={() => router.navigate('/group-call')} />
          </View>
        ) : null}
        {canAdmins ? (
          <View className="mt-3">
            <MenuRow icon="users" label="Administrators" hint="Accounts, permissions and groups" onPress={() => router.navigate('/admins')} />
          </View>
        ) : null}
        {canTrack ? (
          <View className="mt-3">
            <MenuRow icon="navigation" label="Track playback" hint="Replay where a helmet has been" onPress={() => router.navigate('/track')} />
          </View>
        ) : null}
        {canFences ? (
          <View className="mt-3">
            <MenuRow icon="hexagon" label="Fences" hint="Work areas and no-entry zones" onPress={() => router.push('/fences')} />
          </View>
        ) : null}
        {canPhotos ? (
          <View className="mt-3">
            <MenuRow icon="image" label="Photo Record" hint="Pictures taken by the helmets" onPress={() => router.navigate('/photos')} />
          </View>
        ) : null}
        {canVideos ? (
          <View className="mt-3">
            <MenuRow icon="film" label="Video Record" hint="Recordings, and clips still on a helmet" onPress={() => router.navigate('/videos')} />
          </View>
        ) : null}
        {canWifi ? (
          <View className="mt-3">
            <MenuRow
              icon="wifi"
              label="Site Wi-Fi"
              hint="The network every helmet joins"
              onPress={() => router.navigate('/wifi')}
            />
          </View>
        ) : null}

        <SectionTitle className="mt-6">About</SectionTitle>
        <Card className="py-1">
          <View className="items-center border-b border-slate-100 pb-3 pt-4">
            <CompanyLogo width={112} />
          </View>
          {company.companyName ? <Row label="Company" value={company.companyName} /> : null}
          {company.supportEmail ? <Row label="Support" value={company.supportEmail} /> : null}
          <Row label="App version" value={Constants.expoConfig?.version ?? '—'} />
          <Row label="Data source" value={env.useMocks ? 'Sample data' : 'Live backend'} last />
        </Card>
        <View className="mt-3">
          <MenuRow icon="file-text" label="Privacy policy" hint="How E5 handles your data" onPress={openPrivacyPolicy} />
        </View>

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
