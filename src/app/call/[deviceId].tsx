import { useLocalSearchParams } from 'expo-router'
import { CallScreen } from '@/modules/calls/components/CallScreen'

/** A call with one helmet. Who may call is decided inside (an open SOS alarm, or the live permission). */
export default function CallRoute() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()
  return <CallScreen deviceId={decodeURIComponent(String(deviceId ?? ''))} />
}
