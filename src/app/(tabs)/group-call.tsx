import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Container } from '@/shared/components/Container'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { useCan } from '@/shared/lib/permissions'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { broadcastAvailable } from '@/modules/group-call/api/broadcast.api'
import { GroupPicker } from '@/modules/group-call/components/GroupPicker'
import { RosterPicker } from '@/modules/group-call/components/RosterPicker'
import { VoiceMessagePanel } from '@/modules/group-call/components/VoiceMessagePanel'
import { reachableDevices } from '@/modules/group-call/lib/roster'
import { useGroups } from '@/modules/users/hooks/useAdmins'

function Heading({ children }: { children: string }) {
  return <Text className="mb-2 mt-6 font-sans-semibold text-xs uppercase tracking-wide text-slate-500">{children}</Text>
}

function GroupCallScreen() {
  const { devices } = useDeviceViews()
  const { groups } = useGroups()
  const canSend = useCan('groupCall:write')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [roster, setRoster] = useState<string[]>([])
  const group = groups.find((g) => g.id === groupId) ?? null
  const reachable = reachableDevices(devices, roster)

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-0">
        <Container max={640}>
          <PageTitle title="Group call" padded={false} />
          {!broadcastAvailable() ? (
            <Text className="mb-4 rounded-xl bg-slate-100 p-3 text-sm leading-5 text-slate-600">
              Sending voice messages to a group isn't switched on in this build yet.
            </Text>
          ) : null}
          <Text className="mb-1 rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
            Live group calls aren't available in the app yet. A voice message plays on every chosen helmet, now or when it reconnects.
          </Text>

          <Heading>Group</Heading>
          <GroupPicker selectedId={groupId} onSelect={setGroupId} />

          {!group ? (
            <Text className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">Select a group to start.</Text>
          ) : (
            <View>
              <Heading>{`Helmets for ${group.name}`}</Heading>
              <RosterPicker devices={devices} roster={roster} onChange={setRoster} />
              <Heading>Voice message</Heading>
              {canSend && broadcastAvailable() ? (
                <VoiceMessagePanel reachable={reachable} />
              ) : (
                <Text className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                  {canSend ? "Voice messages aren't switched on in this build yet." : 'Your role can see this but not send messages.'}
                </Text>
              )}
            </View>
          )}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function GroupCallRoute() {
  return (
    <RequirePermission permission="groupCall:read" fallback="/more">
      <GroupCallScreen />
    </RequirePermission>
  )
}
