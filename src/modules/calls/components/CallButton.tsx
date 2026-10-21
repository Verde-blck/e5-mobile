import { router } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { useCallAccess } from '../hooks/useCallAccess'

/** Opens the call screen. A call is audio unless `video` is asked for. */
export function openCall(deviceId: string, video = false) {
  router.push(`/call/${encodeURIComponent(deviceId)}${video ? '?video=1' : ''}`)
}

/**
 * Starts a call with a helmet. Shows only when this build can make calls AND this account may call
 * this helmet (an open SOS alarm for it, or the live-view management permission), so there is
 * never a button that can only fail.
 */
export function CallButton({ deviceId, className, sosOnly = false }: { deviceId: string; className?: string; sosOnly?: boolean }) {
  const { supported, access } = useCallAccess(deviceId)
  if (!supported || !access.allowed) return null
  const sos = access.basis === 'sos'
  // Ordinary calls are made from the Group call module; a helmet's own screen only offers joining its open SOS.
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
