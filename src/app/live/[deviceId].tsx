import { useLocalSearchParams } from 'expo-router'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { LiveViewScreen } from '@/modules/live/components/LiveViewScreen'

/** Watching one helmet's camera. Needs live view (SURVEILLANCE, `live:read`). */
export default function LiveViewRoute() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()
  return (
    <RequirePermission permission="live:read" fallback="/more">
      <LiveViewScreen deviceId={decodeURIComponent(String(deviceId ?? ''))} />
    </RequirePermission>
  )
}
