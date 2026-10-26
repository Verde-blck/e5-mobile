// Keys, actions and the permission strings are identical to the web
// dashboard's, so a role edited on one platform means the same on the other.
import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'

export type IconName = ComponentProps<typeof Feather>['name']

export type ModuleKey =
  | 'dashboard'
  | 'devices'
  | 'map'
  | 'trackPlayback'
  | 'groupCall'
  | 'photos'
  | 'videos'
  | 'alarms'
  | 'users'
  | 'unitSettings'
  | 'wifi'
  | 'profile'
  | 'live'
  | 'fences'
  | 'groups'

export type Action = 'read' | 'write' | 'delete'
export type Permission = `${ModuleKey}:${Action}`

export interface ModuleDef {
  key: ModuleKey
  label: string
  icon: IconName
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  // The key stays `devices` so every permission string keeps working.
  { key: 'devices', label: 'Monitoring Center', icon: 'activity' },
  { key: 'map', label: 'Live Map', icon: 'map' },
  { key: 'trackPlayback', label: 'Track Playback', icon: 'navigation' },
  { key: 'groupCall', label: 'Group Call', icon: 'radio' },
  { key: 'photos', label: 'Photo Record', icon: 'camera' },
  { key: 'videos', label: 'Video Record', icon: 'video' },
  { key: 'alarms', label: 'Alarm Record', icon: 'bell' },
  { key: 'users', label: 'Administrators', icon: 'users' },
  { key: 'unitSettings', label: 'Unit Setting', icon: 'sliders' },
  // Key stays "wifi" so existing permissions keep working.
  { key: 'wifi', label: 'Connectivity', icon: 'wifi' },
  { key: 'profile', label: 'Company Profile', icon: 'briefcase' },
]

export const ACTIONS: Action[] = ['read', 'write', 'delete']

export const CAPABILITIES: ModuleKey[] = ['live', 'fences', 'groups']

export const ALL_PERMISSIONS: Permission[] = [...MODULES.map((m) => m.key), ...CAPABILITIES].flatMap((key) =>
  ACTIONS.map((a): Permission => `${key}:${a}`)
)
