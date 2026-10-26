import { useLocalSearchParams } from 'expo-router'
import { GroupCallScreen } from '@/modules/live/components/GroupCallScreen'
import { GROUP_CALL_MAX } from '@/modules/live/lib/groupPlan'

export default function ConferenceRoute() {
  const { ids, video } = useLocalSearchParams<{ ids?: string; video?: string }>()
  const list = String(ids ?? '').split(',').map((id) => decodeURIComponent(id)).filter(Boolean).slice(0, GROUP_CALL_MAX)
  return <GroupCallScreen ids={list} video={video === '1'} />
}
