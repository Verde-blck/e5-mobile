import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { useCan } from '@/shared/lib/permissions'
import { liveAvailable } from '../api/live.api'

/**
 * Watch a helmet's camera. Shows only when this build can, this account has live view (SURVEILLANCE), and the helmet
 * isn't deactivated, so there is never a button that can only fail.
 */
export function LiveButton({ deviceId, active, className }: { deviceId: string; active: boolean; className?: string }) {
  const canWatch = useCan('live:read')
  if (!liveAvailable() || !canWatch || !active) return null
  return <Button title="Watch live" icon="video" variant="secondary" className={className} onPress={() => router.push(`/live/${encodeURIComponent(deviceId)}`)} />
}
