// Copied verbatim from the web dashboard's users/lib/permissions.ts so a role shows the same
// screens on a tablet as in the browser. Don't edit it to fix the app: change the web file and
// copy it across. Mobile-only differences belong where the permissions are used.
import type { ModuleKey } from '@/shared/constants/modules'

export type ApiPermission =
  | 'DASHBOARD'
  | 'MONITORING_CENTER'
  | 'MONITORING_CENTER_MANAGE'
  | 'SURVEILLANCE'
  | 'SURVEILLANCE_MANAGE'
  | 'TRACK_PLAYBACK'
  | 'TASK_MANAGE'
  | 'TASK_LIST'
  | 'RELEASE_TASK'
  | 'GROUP_CALL'
  | 'GROUP_SETTING'
  | 'ADMINISTRATOR_SETTING'
  | 'UNIT_SETTING'
  | 'UNIT_SETTING_MANAGE'
  | 'FENCE'
  | 'FENCE_MANAGE'
  | 'BLUETOOTH_BEACON'
  | 'ALARM_RECORD'
  | 'ALARM_RECORD_MANAGE'
  | 'PHOTO_RECORD'
  | 'PHOTO_RECORD_MANAGE'
  | 'VIDEO_RECORD'
  | 'VIDEO_RECORD_MANAGE'
  | 'ATTENDANCE_RECORD'

export interface PermissionNode {
  label: string
  code?: ApiPermission
  manageCode?: ApiPermission
  hint?: string
  children?: PermissionNode[]
}

// Deliberately shorter than the backend's catalogue: modules with no screen yet (Task Manager, Bluetooth Beacon,
// Attendance Record) aren't offered, because granting access to something that doesn't exist would only confuse.
export const PERMISSION_TREE: PermissionNode[] = [
  { label: 'Dashboard', code: 'DASHBOARD' },
  {
    label: 'Monitoring Center',
    code: 'MONITORING_CENTER',
    manageCode: 'MONITORING_CENTER_MANAGE',
    hint: 'View helmets and the map · change: register, rename, commands',
  },
  {
    label: 'Live view and calls',
    code: 'SURVEILLANCE',
    manageCode: 'SURVEILLANCE_MANAGE',
    hint: 'Watch live and the live wall · change: make calls',
  },
  { label: 'Track Playback', code: 'TRACK_PLAYBACK' },
  { label: 'Group Call', code: 'GROUP_CALL', hint: 'Group calls and voice messages' },
  {
    label: 'Fences',
    code: 'FENCE',
    manageCode: 'FENCE_MANAGE',
    hint: 'See fences on the map · change: draw and edit them',
  },
  {
    label: 'Set',
    children: [
      { label: 'Group Setting', code: 'GROUP_SETTING' },
      { label: 'Administrator Setting', code: 'ADMINISTRATOR_SETTING', hint: 'Includes Company Profile' },
      {
        label: 'Unit Setting',
        code: 'UNIT_SETTING',
        manageCode: 'UNIT_SETTING_MANAGE',
        hint: 'Includes Connectivity · change: save settings, switch networks',
      },
    ],
  },
  {
    label: 'Alarm Record',
    code: 'ALARM_RECORD',
    manageCode: 'ALARM_RECORD_MANAGE',
    hint: 'Change: resolve and reopen',
  },
  { label: 'Photo Record', code: 'PHOTO_RECORD', manageCode: 'PHOTO_RECORD_MANAGE' },
  {
    label: 'Video Record',
    code: 'VIDEO_RECORD',
    manageCode: 'VIDEO_RECORD_MANAGE',
    hint: 'Change: upload from helmets, lock clips',
  },
]

export function allPermissionCodes(): ApiPermission[] {
  const codes: ApiPermission[] = []
  const walk = (nodes: PermissionNode[]) => {
    for (const node of nodes) {
      if (node.code) codes.push(node.code)
      if (node.manageCode) codes.push(node.manageCode)
      if (node.children) walk(node.children)
    }
  }
  walk(PERMISSION_TREE)
  return codes
}

export function viewCodeOf(code: string): string {
  return code.endsWith('_MANAGE') ? code.slice(0, -'_MANAGE'.length) : code
}

export const MODULE_PERMISSION: Record<ModuleKey, { view: ApiPermission; manage?: ApiPermission }> = {
  dashboard: { view: 'DASHBOARD' },
  devices: { view: 'MONITORING_CENTER', manage: 'MONITORING_CENTER_MANAGE' },
  map: { view: 'MONITORING_CENTER', manage: 'MONITORING_CENTER_MANAGE' },
  live: { view: 'SURVEILLANCE', manage: 'SURVEILLANCE_MANAGE' },
  trackPlayback: { view: 'TRACK_PLAYBACK' },
  groupCall: { view: 'GROUP_CALL' },
  groups: { view: 'GROUP_SETTING' },
  photos: { view: 'PHOTO_RECORD', manage: 'PHOTO_RECORD_MANAGE' },
  videos: { view: 'VIDEO_RECORD', manage: 'VIDEO_RECORD_MANAGE' },
  alarms: { view: 'ALARM_RECORD', manage: 'ALARM_RECORD_MANAGE' },
  fences: { view: 'FENCE', manage: 'FENCE_MANAGE' },
  users: { view: 'ADMINISTRATOR_SETTING' },
  unitSettings: { view: 'UNIT_SETTING', manage: 'UNIT_SETTING_MANAGE' },
  wifi: { view: 'UNIT_SETTING', manage: 'UNIT_SETTING_MANAGE' },
  profile: { view: 'ADMINISTRATOR_SETTING' },
}

export function expandPermissions(granted: string[]): string[] {
  const held = new Set(granted)
  const expanded: string[] = []

  for (const [moduleKey, { view, manage }] of Object.entries(MODULE_PERMISSION)) {
    const canManage = manage ? held.has(manage) : held.has(view)
    const canView = canManage || held.has(view)
    if (canManage) expanded.push(`${moduleKey}:read`, `${moduleKey}:write`, `${moduleKey}:delete`)
    else if (canView) expanded.push(`${moduleKey}:read`)
  }

  return [...new Set(expanded)]
}
