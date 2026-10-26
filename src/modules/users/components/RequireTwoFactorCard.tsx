import { useState } from 'react'
import { Switch, View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { useSecurityPolicy, useSetSecurityPolicy } from '../hooks/useAdmins'

export function RequireTwoFactorCard({ canEdit }: { canEdit: boolean }) {
  const { require2fa, isLoading, isError } = useSecurityPolicy()
  const set = useSetSecurityPolicy()
  const [problem, setProblem] = useState<string | null>(null)
  if (isError) return null
  const on = set.isPending ? (set.variables as boolean) : (require2fa ?? false)

  return (
    <View className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-sm">Require two-step verification for everyone</Text>
          <Text className="mt-1 text-xs leading-5 text-slate-500">
            {on ? 'On. Anyone without it is taken straight to set it up when they sign in, and nobody can turn it off.' : 'Off. Each person chooses whether to use it.'}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Require two-step verification for everyone"
          value={on}
          disabled={!canEdit || isLoading || set.isPending}
          onValueChange={(next) => {
            setProblem(null)
            set.mutate(next, { onError: () => setProblem("Couldn't change the setting. Check your connection and try again.") })
          }}
        />
      </View>
      {problem ? <Text accessibilityRole="alert" className="mt-2 text-xs text-red-600">{problem}</Text> : null}
    </View>
  )
}
