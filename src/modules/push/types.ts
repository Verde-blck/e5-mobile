export type PushStatus =
  | 'off'
  | 'unavailable'
  | 'needs-permission'
  | 'blocked'
  | 'registering'
  | 'on'
  | 'error'

export interface AlarmPush {
  kind: 'alarm'
  alarmId: string
  alarmType?: string
  severity?: 'critical' | 'warning' | 'normal'
  deviceId?: string
  deviceName?: string
}

export interface AlarmResolvedPush {
  kind: 'alarm-resolved'
  alarmId: string
}

export type PushMessage = AlarmPush | AlarmResolvedPush
