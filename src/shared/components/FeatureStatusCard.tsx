import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { env } from '@/config/env'
import { featureStatuses } from '@/shared/lib/features'
import { navigationPosition, useLayout } from '@/shared/lib/layout'
import { cn } from '@/shared/lib/cn'
import { useAuthStore } from '@/shared/store/authStore'
import { Card } from './Card'
import { Text } from './Text'

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** What a switch effectively is: sample data mode has live view and voice messages on whatever the switches say. */
const effective = (raw: boolean) => (raw ? 'on' : env.useMocks ? 'on (sample data)' : 'off')
const onOff = (on: boolean) => (on ? 'on' : 'off')

/**
 * Why a module might be missing: the build's switches, the account's permissions and this screen's navigation, with
 * the first thing stopping each feature. For "I turned it on and still can't find it".
 */
export function FeatureStatusCard() {
  const user = useAuthStore((s) => s.user)
  const { width, size } = useLayout()
  const [codes, setCodes] = useState(false)
  const features = featureStatuses({
    mocks: env.useMocks,
    liveOn: env.liveEnabled,
    broadcastOn: env.broadcastEnabled,
    permissions: user?.permissions ?? [],
    superAdmin: user?.superAdmin === true,
    widthDp: width,
  })
  const apiCodes = user?.apiPermissions ?? []

  const Line = ({ label, value }: { label: string; value: string }) => (
    <View className="flex-row gap-3 py-1">
      <Text className="w-24 text-xs text-slate-400">{label}</Text>
      <Text className="min-w-0 flex-1 text-xs text-slate-700">{value}</Text>
    </View>
  )

  return (
    <Card className="gap-1">
      <Line label="Data" value={env.useMocks ? 'Sample data (built in, no backend)' : `Live backend: ${host(env.apiBaseUrl)}`} />
      <Line label="Switches" value={`Live view and calls ${effective(env.liveEnabled)} · Voice messages ${effective(env.broadcastEnabled)} · Push alerts ${onOff(env.pushEnabled)}`} />
      <Line label="Screen" value={`${Math.round(width)} dp wide: ${navigationPosition(size) === 'left' ? 'side rail' : 'bottom bar (more modules are in More)'}`} />
      <Line label="Account" value={user ? `${user.username}, ${user.role}${user.superAdmin ? ' (full access)' : ''}` : 'Not signed in'} />
      <Pressable accessibilityRole="button" onPress={() => setCodes((c) => !c)} hitSlop={6} className="flex-row items-center gap-1 self-start py-1">
        <Feather name={codes ? 'chevron-down' : 'chevron-right'} size={14} color="#0A6659" />
        <Text className="text-xs text-brand-primary">{codes ? 'Hide' : 'Show'} the backend's permission codes ({apiCodes.length})</Text>
      </Pressable>
      {codes ? <Text className="font-mono text-[11px] leading-4 text-slate-600">{apiCodes.length ? apiCodes.join(', ') : user?.superAdmin ? 'None listed: a super admin has full access.' : 'None. This account has no permissions in the backend.'}</Text> : null}

      <View className="mt-2 border-t border-slate-100 pt-2">
        {features.map((f) => (
          <View key={f.key} className="flex-row gap-2 py-1.5">
            <Feather name={f.available ? 'check-circle' : 'x-circle'} size={16} color={f.available ? '#059669' : '#DC2626'} style={{ marginTop: 1 }} />
            <View className="min-w-0 flex-1">
              <Text className={cn('text-sm', f.available ? 'font-sans-medium' : 'font-sans-semibold text-red-700')}>{f.label}</Text>
              <Text className="text-xs leading-4 text-slate-500">{f.where}</Text>
              <Text className={cn('text-xs leading-4', f.available ? 'text-slate-400' : 'text-slate-700')}>{f.reason}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  )
}
