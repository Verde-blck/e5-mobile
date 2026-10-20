import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { useCallAccess } from '../hooks/useCallAccess'

export function openCall(deviceId: string) {
  router.push(`/call/${encodeURIComponent(deviceId)}`)
}

/**
 * Starts a call with a helmet. Shows only when this build can make calls AND this account may call
 * this helmet (an open SOS alarm for it, or the live-view management permission), so there is
 * never a button that can only fail.
 */
export function CallButton({ deviceId, className }: { deviceId: string; className?: string }) {
  const { supported, access } = useCallAccess(deviceId)
  if (!supported || !access.allowed) return null
  const sos = access.basis === 'sos'
  return (
    <Button
      title={sos ? 'Join SOS call' : 'Call helmet'}
      icon="phone"
      variant={sos ? 'danger' : 'secondary'}
      className={className}
      onPress={() => openCall(deviceId)}
    />
  )
}
