import { useState } from 'react'
import { View } from 'react-native'
import { Chip } from '@/shared/components/Chip'
import { Container } from '@/shared/components/Container'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { useCan } from '@/shared/lib/permissions'
import { AdminList } from '@/modules/users/components/AdminList'
import { GroupList } from '@/modules/users/components/GroupList'

function AdminsScreen() {
  const [tab, setTab] = useState<'admins' | 'groups'>('admins')
  const canEdit = useCan('users:write')
  return (
    <Screen>
      <Container max={720}>
        <PageTitle title="Administrators" />
        <View className="flex-row gap-2 px-4 pt-3">
          <Chip label="Administrators" on={tab === 'admins'} onPress={() => setTab('admins')} />
          <Chip label="Groups" on={tab === 'groups'} onPress={() => setTab('groups')} />
        </View>
        {!canEdit ? (
          <Text className="mx-4 mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">You can view these settings but not change them.</Text>
        ) : null}
        {tab === 'admins' ? <AdminList canEdit={canEdit} /> : <GroupList canEdit={canEdit} />}
      </Container>
    </Screen>
  )
}

export default function AdminsRoute() {
  return (
    <RequirePermission permission="users:read" fallback="/more">
      <AdminsScreen />
    </RequirePermission>
  )
}
