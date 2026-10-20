/** Where alarm alerts for a locked tablet stand, in the words the person sees. */
export type PushStatus =
  | 'off' // not switched on in this build yet: the backend can't send push
  | 'unavailable' // this device or build can't do push (no Google services, or Firebase isn't set up)
  | 'needs-permission' // notifications haven't been allowed yet
  | 'blocked' // notifications were refused: only the tablet's settings can change that
  | 'registering'
  | 'on'
  | 'error' // permission is fine but the backend wouldn't take the registration

/** What the backend puts in the push's data when an alarm is raised. */
export interface AlarmPush {
  kind: 'alarm'
  alarmId: string
  alarmType?: string
  severity?: 'critical' | 'warning' | 'normal'
  deviceId?: string
  deviceName?: string
}

/** Sent when an alarm is resolved, so other tablets can clear it. */
export interface AlarmResolvedPush {
  kind: 'alarm-resolved'
  alarmId: string
}

export type PushMessage = AlarmPush | AlarmResolvedPush
