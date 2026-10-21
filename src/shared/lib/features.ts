import { MEDIUM_MIN_DP } from './layout'

export interface FeatureInput {
  /** Sample data mode: every feature is on, with built-in data. */
  mocks: boolean
  /** The EXPO_PUBLIC_LIVE_ENABLED and EXPO_PUBLIC_BROADCAST_ENABLED switches. */
  liveOn: boolean
  broadcastOn: boolean
  /** What the account can do in the app, and the backend's own permission codes it came from. */
  permissions: readonly string[]
  superAdmin: boolean
  widthDp: number
}

export interface FeatureStatus {
  key: string
  label: string
  /** Where to look for it in the app. */
  where: string
  available: boolean
  /** Why it is missing, in words that say what to change; or a short note when it is there. */
  reason: string
}

const LIVE_SWITCH = 'Switched off in this build. Set EXPO_PUBLIC_LIVE_ENABLED=true in .env and restart with: npx expo start --clear (for an APK, build with the live profile).'
const BROADCAST_SWITCH = 'Switched off in this build. Set EXPO_PUBLIC_BROADCAST_ENABLED=true in .env and restart with: npx expo start --clear (for an APK, build with the live profile).'

/**
 * For each feature that can be missing, whether it is there and, if not, the first thing that is stopping it:
 * the switch for this build, or the account's permission. This is the answer to "I turned it on and still can't
 * find it": it names the cause instead of leaving it a guess.
 */
export function featureStatuses(input: FeatureInput): FeatureStatus[] {
  const { mocks, liveOn, broadcastOn, permissions, widthDp } = input
  const can = (p: string) => input.superAdmin || permissions.includes(p)
  const live = mocks || liveOn
  const broadcast = mocks || broadcastOn
  const rail = widthDp >= MEDIUM_MIN_DP
  const module = (name: string) => (rail ? `${name} in the side rail` : `More > ${name}`)

  const check = (key: string, label: string, where: string, switchOn: boolean, switchText: string, perm: string, permText: string, okText: string): FeatureStatus => {
    if (!switchOn) return { key, label, where, available: false, reason: switchText }
    if (!can(perm)) return { key, label, where, available: false, reason: permText }
    return { key, label, where, available: true, reason: okText }
  }

  return [
    check('wall', 'Live wall', module('Live wall'), live, LIVE_SWITCH, 'live:read', "This account doesn't have live view. In the backend that is the SURVEILLANCE permission.", 'Available.'),
    check('watch', 'Watch live', 'A helmet\'s own screen', live, LIVE_SWITCH, 'live:read', "This account doesn't have live view. In the backend that is the SURVEILLANCE permission.", 'Available. Not shown on a deactivated helmet.'),
    check('call', 'Call a helmet (audio or video)', module('Group call'), live, LIVE_SWITCH, 'live:write', "This account can't place calls (backend permission SURVEILLANCE_MANAGE). It can still join a helmet's open SOS call.", 'Available.'),
    // Reading a helmet's messages needs only the permission; the switch is about sending.
    check('messages', 'Voice messages with a helmet', 'A helmet\'s own screen', true, '', 'groupCall:read', "This account doesn't have voice messages. In the backend that is the GROUP_CALL permission.", 'Available (reading).'),
    check('send', 'Sending a voice message', 'A helmet\'s own screen', broadcast, BROADCAST_SWITCH, 'groupCall:write', "This account can't send voice messages (backend permission GROUP_CALL).", 'Available. On a tablet the backend must also accept .m4a (docs/GROUP_CALL.md).'),
  ]
}
