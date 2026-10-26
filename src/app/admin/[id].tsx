import { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { Chip } from '@/shared/components/Chip'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import type { ApiPermission } from '@/shared/constants/backend-permissions'
import { useAuthStore } from '@/shared/store/authStore'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { PermissionTree } from '@/modules/users/components/PermissionTree'
import { useAdmins, useCreateAdmin, useGroups, usePermissionCatalogue, useUpdateAdmin } from '@/modules/users/hooks/useAdmins'
import { groupLabel, rowRules, saveErrorMessage, validateAdmin } from '@/modules/users/lib/rules'

function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 font-sans-medium text-sm text-slate-700">{children}</Text>
}

function AdminFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === 'new'
  const me = useAuthStore((s) => s.user)
  const { admins, isLoading } = useAdmins()
  const { groups } = useGroups()
  const { devices } = useDeviceViews()
  const available = usePermissionCatalogue()
  const create = useCreateAdmin()
  const update = useUpdateAdmin()

  const existing = isNew ? undefined : admins.find((a) => String(a.id) === id)
  const grantable = useMemo(() => (me?.superAdmin ? null : new Set(me?.apiPermissions ?? [])), [me])

  const [loaded, setLoaded] = useState(isNew)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [permissions, setPermissions] = useState<ApiPermission[]>([])
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  const [deviceFilter, setDeviceFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded && existing) {
      setUsername(existing.username)
      setDepartment(existing.department ?? '')
      setRole(existing.role ?? '')
      setPhone(existing.mobilePhone ?? '')
      setGroupId(existing.groupId ?? null)
      setPermissions(existing.permissions)
      setDeviceIds(existing.deviceIds)
      setLoaded(true)
    }
  }, [existing, loaded])

  if (!loaded) {
    return <Screen top={false}>{isLoading ? <LoadingState /> : <EmptyState icon="help-circle" title="Account not found" hint="It may have been deleted." />}</Screen>
  }
  if (existing && rowRules(existing, me).lockedSuper) {
    return (
      <Screen top={false}>
        <EmptyState icon="lock" title="Only a super admin can change this account" hint="Super admins can only be edited by another super admin." />
      </Screen>
    )
  }

  const editing = !!existing
  const pending = create.isPending || update.isPending
  const needle = deviceFilter.trim().toLowerCase()
  const shown = devices.filter((d) => !needle || d.name.toLowerCase().includes(needle) || d.id.includes(needle))
  const allHelmets = deviceIds.length === 0
  const group = groupLabel(groupId, groups)

  async function submit() {
    const problem = validateAdmin({ username, password, permissions }, editing)
    setError(problem)
    if (problem) return
    const shared = {
      username: username.trim(),
      department: department.trim() || undefined,
      role: role.trim() || undefined,
      mobilePhone: phone.trim() || undefined,
      groupId,
      permissions,
      deviceIds,
    }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, patch: password ? { ...shared, password } : shared })
      else await create.mutateAsync({ ...shared, password })
      router.back()
    } catch (e) {
      setError(saveErrorMessage(e, editing))
    }
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: editing ? `Edit ${existing?.username}` : 'Add administrator' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-4">
          <Container max={640}>
            <View className="gap-5">
              <TextField label="Account name" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
              <TextField label={editing ? 'New password (leave empty to keep the current one)' : 'Login password'} value={password} onChangeText={setPassword} secret autoCapitalize="none" autoCorrect={false} />
              <TextField label="Department" value={department} onChangeText={setDepartment} />
              <TextField label="Role" value={role} onChangeText={setRole} placeholder="e.g. Operator" />
              <TextField label="Mobile phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <View>
                <Label>Group</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Chip label="No group" on={groupId === null} onPress={() => setGroupId(null)} />
                  {groups.map((g) => (
                    <Chip key={g.id} label={g.name} on={groupId === g.id} onPress={() => setGroupId(g.id)} />
                  ))}
                </View>
                {group.missing ? <Text className="mt-1.5 text-xs text-amber-700">This account's group no longer exists. Choose another, or none.</Text> : <Text className="mt-1.5 text-xs text-slate-500">One group per administrator.</Text>}
              </View>

              <View>
                <Label>Permission settings</Label>
                {existing?.superAdmin ? <Text className="mb-2 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">This is a super admin, who has full access whatever is ticked here.</Text> : null}
                <PermissionTree granted={permissions} available={available} grantable={grantable} onChange={setPermissions} />
              </View>

              <View>
                <Label>Helmets</Label>
                <View className="flex-row gap-2">
                  <Chip label="Every helmet" on={allHelmets} onPress={() => setDeviceIds([])} />
                  <Chip label="Chosen helmets" on={!allHelmets} onPress={() => devices.length > 0 && setDeviceIds(devices.slice(0, 1).map((d) => d.id))} />
                </View>
                {!allHelmets ? (
                  <View className="mt-2 gap-2">
                    <TextField label="Filter" value={deviceFilter} onChangeText={setDeviceFilter} placeholder="Name or ID" autoCapitalize="none" />
                    <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {shown.map((d, i) => {
                        const on = deviceIds.includes(d.id)
                        return (
                          <Pressable
                            key={d.id}
                            accessibilityRole="checkbox"
                            accessibilityLabel={d.name}
                            accessibilityState={{ checked: on }}
                            aria-checked={on}
                            onPress={() => {
                              const next = on ? deviceIds.filter((x) => x !== d.id) : [...deviceIds, d.id]
                              // Unticking the last one would silently mean "every helmet".
                              if (next.length > 0) setDeviceIds(next)
                            }}
                            className={cn('min-h-12 flex-row items-center gap-3 px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100')}
                          >
                            <View className={cn('h-5 w-5 items-center justify-center rounded border', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300')}>
                              {on ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                            </View>
                            <Text className="flex-1 text-sm" numberOfLines={1}>{d.name}</Text>
                            <Text className="font-mono text-xs text-slate-400">{d.id.slice(-6)}</Text>
                          </Pressable>
                        )
                      })}
                      {shown.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">No helmets match.</Text> : null}
                    </View>
                  </View>
                ) : (
                  <Text className="mt-1.5 text-xs text-slate-500">This account can see every helmet.</Text>
                )}
              </View>

              {error ? <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</Text> : null}

              <View className="gap-2 border-t border-slate-200 pt-4">
                <Button title={editing ? 'Save changes' : 'Create administrator'} loading={pending} onPress={() => void submit()} />
                <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
              </View>
            </View>
          </Container>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

export default function AdminFormRoute() {
  return (
    <RequirePermission permission="users:write" fallback="/admins">
      <AdminFormScreen />
    </RequirePermission>
  )
}
