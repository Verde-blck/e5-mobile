import { ActivityIndicator, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import type { IconName } from '@/shared/constants/modules'
import { Button } from './Button'
import { Text } from './Text'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 p-8">
      <ActivityIndicator size="large" color="#0A6659" />
      <Text className="text-sm text-slate-500">{label}</Text>
    </View>
  )
}

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
}: {
  icon?: IconName
  title: string
  hint?: string
}) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Feather name={icon} size={24} color="#64748B" />
      </View>
      <Text className="font-sans-semibold text-base text-slate-800">{title}</Text>
      {hint ? <Text className="text-center text-sm text-slate-500">{hint}</Text> : null}
    </View>
  )
}

export function ErrorState({
  title = "Couldn't load this",
  hint = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string
  hint?: string
  onRetry?: () => void
}) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <Feather name="alert-circle" size={24} color="#DC2626" />
      </View>
      <Text className="font-sans-semibold text-base text-slate-800">{title}</Text>
      <Text className="mb-3 text-center text-sm text-slate-500">{hint}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  )
}
