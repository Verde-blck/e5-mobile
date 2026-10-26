import { useLocalSearchParams } from 'expo-router'
import { CallScreen } from '@/modules/calls/components/CallScreen'

export default function CallRoute() {
  const { deviceId, video } = useLocalSearchParams<{ deviceId: string; video?: string }>()
  return <CallScreen deviceId={decodeURIComponent(String(deviceId ?? ''))} video={video === '1'} />
}
