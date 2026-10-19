import type { Permission } from './modules'

/**
 * Translates the backend's flat permission codes (GET /api/permissions) into
 * the app's `module:action` guards.
 *
 * The backend rule, from Cypher's 16 Oct update: holding CODE_MANAGE includes
 * CODE (view). So X means "read" and X_MANAGE means read + write + delete.
 *
 * VERIFY against the web dashboard's expandPermissions(): this table was
 * written from the backend's code list, not copied from the web. If the two
 * differ, the same role would show different screens on phone and browser.
 * The one judgement call is MONITORING_CENTER also unlocking Live Map.
 */
type Grant = Permission[]

const read = (...modules: string[]): Grant => modules.map((m) => `${m}:read` as Permission)
const manage = (...modules: string[]): Grant =>
  modules.flatMap((m) => [`${m}:read`, `${m}:write`, `${m}:delete`] as Permission[])

const CODE_GRANTS: Record<string, Grant> = {
  DASHBOARD: read('dashboard'),
  MONITORING_CENTER: read('devices', 'map'),
  MONITORING_CENTER_MANAGE: manage('devices', 'map'),
  TRACK_PLAYBACK: read('trackPlayback'),
  GROUP_CALL: read('groupCall'),
  GROUP_SETTING: manage('groupCall'),
  ADMINISTRATOR_SETTING: manage('users'),
  // Wi-Fi is its own module but follows the Unit Setting permission.
  UNIT_SETTING: read('unitSettings', 'wifi'),
  UNIT_SETTING_MANAGE: manage('unitSettings', 'wifi'),
  ALARM_RECORD: read('alarms'),
  ALARM_RECORD_MANAGE: manage('alarms'),
  PHOTO_RECORD: read('photos'),
  PHOTO_RECORD_MANAGE: manage('photos'),
  VIDEO_RECORD: read('videos'),
  VIDEO_RECORD_MANAGE: manage('videos'),

  // Real codes with no screen in the mobile app yet. Listed so that "known but
  // not exposed" is visible here rather than looking like an oversight.
  SURVEILLANCE: [],
  SURVEILLANCE_MANAGE: [],
  FENCE: [],
  FENCE_MANAGE: [],
  TASK_MANAGE: [],
  TASK_LIST: [],
  RELEASE_TASK: [],
  BLUETOOTH_BEACON: [],
  ATTENDANCE_RECORD: [],
}

/** Retired by the backend; values sent with it are turned into FENCE. */
const RETIRED: Record<string, string> = { GEO_FENCE: 'FENCE' }

export function expandPermissions(codes: readonly string[]): Permission[] {
  const out = new Set<Permission>()
  for (const raw of codes) {
    const code = RETIRED[raw] ?? raw
    for (const grant of CODE_GRANTS[code] ?? []) out.add(grant)
  }
  return [...out]
}
