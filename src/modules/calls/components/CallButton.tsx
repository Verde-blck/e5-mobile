import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { useCallAccess } from '../hooks/useCallAccess'

export function openCall(deviceId: string, video = false) {
  router.push(`/call/${encodeURIComponent(deviceId)}${video ? '?video=1' : ''}`)
}

export function CallButton({ deviceId, className, sosOnly = false }: { deviceId: string; className?: string; sosOnly?: boolean }) {
  const { supported, access } = useCallAccess(deviceId)
  if (!supported || !access.allowed) return null
  const sos = access.basis === 'sos'
  if (sosOnly && !sos) return null
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
