import { useCan } from '@/shared/lib/permissions'
import { useNow } from '@/shared/lib/useNow'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'
import { callAccess, type CallAccess } from '../lib/access'
import { callEngine } from '../lib/engines'

/** What this account can do about calling this helmet, and whether this build can call at all. */
export function useCallAccess(deviceId: string): { supported: boolean; access: CallAccess } {
  const { active } = useAlarms()
  const canManage = useCan('live:write')
  const now = useNow(30_000)
  return { supported: callEngine.isSupported(), access: callAccess({ deviceId, alarms: active, canManage, now }) }
}
