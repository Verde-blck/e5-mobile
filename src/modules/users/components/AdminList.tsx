import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { confirmAction } from '@/shared/lib/confirm'
import { useAuthStore } from '@/shared/store/authStore'
import { useAdmins, useDeleteAdmin, useGroups, useResetTwoFactor } from '../hooks/useAdmins'
import { deleteErrorMessage, describeAccess, groupLabel, resetErrorMessage, rowRules } from '../lib/rules'

export function AdminList({ canEdit }: { canEdit: boolean }) {
  const { admins, isLoading, isError, refetch } = useAdmins()
  const { groups } = useGroups()
  const me = useAuthStore((s) => s.user)
  const remove = useDeleteAdmin()
  const resetTwoFactor = useResetTwoFactor()
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const needle = search.trim().toLowerCase()
  const rows = needle ? admins.filter((a) => a.username.toLowerCase().includes(needle)) : admins

  function askDelete(id: number, username: string) {
    confirmAction({
      title: `Delete ${username}?`,
      message: 'They are signed out straight away and their tablets stop getting alarm alerts. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        setProblem(null)
        remove.mutate(id, { onError: (error) => setProblem(deleteErrorMessage(error)) })
      },
    })
  }

  function askReset(id: number, username: string) {
    confirmAction({
      title: `Reset two-step verification for ${username}?`,
      message: 'Use this when they have lost or changed their phone. They set it up again at their next sign-in, and have to if the company requires it.',
      confirmLabel: 'Reset',
      destructive: true,
      onConfirm: () => {
        setProblem(null)
        setNotice(null)
        resetTwoFactor.mutate(id, { onSuccess: () => setNotice(`Two-step verification reset for ${username}.`), onError: (error) => setProblem(resetErrorMessage(error)) })
      },
    })
  }

  if (isLoading) return <LoadingState label="Loading administrators…" />
  if (isError) return <ErrorState title="Couldn't load administrators" onRetry={() => void refetch()} />

  return (
    <View className="flex-1">
      <View className="gap-3 px-4 pb-2 pt-3">
        <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Account name" autoCapitalize="none" autoCorrect={false} />
        {canEdit ? <Button title="Add administrator" icon="plus" onPress={() => router.push('/admin/new')} /> : null}
        {problem ? <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</Text> : null}
        {notice ? <Text className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</Text> : null}
      </View>

      {rows.length === 0 ? (
        <EmptyState icon="users" title={search ? 'No administrators match' : 'No administrators yet'} hint={search ? 'Try a different account name.' : undefined} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => String(a.id)}
          contentContainerClassName="px-4 pb-10 pt-1"
          renderItem={({ item: admin }) => {
            const rules = rowRules(admin, me)
            const group = groupLabel(admin.groupId, groups)
            return (
              <Card className="mb-3">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-sans-semibold text-base">{admin.username}</Text>
                  {admin.superAdmin ? (
                    <View className="rounded bg-brand-tint px-1.5 py-0.5"><Text className="text-[10px] font-sans-semibold text-brand-primary">Super admin</Text></View>
                  ) : null}
                  {admin.twoFactorEnabled ? (
                    <View className="rounded bg-slate-100 px-1.5 py-0.5"><Text className="text-[10px] text-slate-600">Two-step on</Text></View>
                  ) : null}
                  {rules.isSelf ? (
                    <View className="rounded bg-slate-100 px-1.5 py-0.5"><Text className="text-[10px] text-slate-600">You</Text></View>
                  ) : null}
                </View>
                <Text className="mt-1 text-sm text-slate-600">{[admin.role, admin.department].filter(Boolean).join(' · ') || 'No role or department'}</Text>
                <Text className="mt-0.5 text-sm text-slate-500">{describeAccess(admin)}</Text>
                <Text className={group.missing ? 'mt-0.5 text-sm text-amber-700' : 'mt-0.5 text-sm text-slate-500'}>
                  {group.missing ? group.text : `Group: ${group.text}`}
                  {admin.mobilePhone ? ` · ${admin.mobilePhone}` : ''}
                </Text>
                {canEdit ? (
                  rules.lockedSuper ? (
                    <Text className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-400">Only a super admin can change this account.</Text>
                  ) : (
                    <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
                      <Button title="Edit" variant="secondary" icon="edit-2" className="h-10 flex-1" onPress={() => router.push(`/admin/${admin.id}`)} />
                      {rules.canDelete ? (
                        <Button title="Delete" variant="secondary" icon="trash-2" className="h-10 flex-1" loading={remove.isPending && remove.variables === admin.id} onPress={() => askDelete(admin.id, admin.username)} />
                      ) : null}
                    </View>
                  )
                ) : null}
                {canEdit && !rules.lockedSuper && !rules.isSelf && admin.twoFactorEnabled ? (
                  <Button
                    title="Reset 2FA"
                    variant="secondary"
                    icon="smartphone"
                    className="mt-2 h-10"
                    accessibilityLabel={`Reset two-step verification for ${admin.username}`}
                    loading={resetTwoFactor.isPending && resetTwoFactor.variables === admin.id}
                    onPress={() => askReset(admin.id, admin.username)}
                  />
                ) : null}
              </Card>
            )
          }}
        />
      )}
    </View>
  )
}
