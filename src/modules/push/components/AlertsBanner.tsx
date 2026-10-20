import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { env } from '@/config/env'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { describeStatus } from '../lib/describe'
import { usePushStore } from '../store/pushStore'
import { perform } from './AlertsCard'

/**
 * A nudge at the top of the Dashboard when alerts are switched on in this build but this tablet
 * isn't set up for them, because a tablet that isn't would miss an SOS while locked. It never
 * appears when alerts aren't part of this build, nor once they're working.
 */
export function AlertsBanner() {
  const status = usePushStore((s) => s.status)
  if (!env.pushEnabled || (status !== 'needs-permission' && status !== 'blocked' && status !== 'error')) return null
  const copy = describeStatus(status)
  return (
    <View accessibilityRole="alert" className="mb-4 rounded-2xl bg-amber-50 p-4">
      <View className="flex-row items-start gap-3">
        <Feather name="alert-triangle" size={20} color="#B45309" />
        <View className="flex-1">
          <Text className="font-sans-semibold text-amber-900">{copy.title}</Text>
          <Text className="mt-0.5 text-sm leading-5 text-amber-900">{copy.detail}</Text>
        </View>
      </View>
      {copy.action ? (
        <Button
          className="mt-3 h-11"
          title={copy.action === 'settings' ? 'Open settings' : copy.action === 'retry' ? 'Try again' : 'Turn on alerts'}
          onPress={() => perform(copy.action)}
        />
      ) : null}
    </View>
  )
}
