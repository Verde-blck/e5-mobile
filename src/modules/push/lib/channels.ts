// Channel ids are a contract with the backend, which names one in every
// push; the tablet only plays the siren for a channel that exists here.
export const SOS_CHANNEL = 'sos'
export const ALARM_CHANNEL = 'alarm'
export const SIREN_SOUND = 'sos.wav'

export interface ChannelSpec {
  id: string
  name: string
  description: string
  importance: 'max' | 'high'
  sound: string
  vibrationPattern: number[]
  bypassDnd: boolean
  // Play on the alarm volume, not the notification volume, so a quiet tablet is still loud.
  alarmVolume: boolean
  lightColor: string
}

export const CHANNELS: ChannelSpec[] = [
  {
    id: SOS_CHANNEL,
    name: 'SOS and critical alarms',
    description: 'SOS, fall, near-electric, no-movement, silent and dangerous gas alarms. Plays a siren.',
    importance: 'max',
    sound: SIREN_SOUND,
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    bypassDnd: true,
    alarmVolume: true,
    lightColor: '#DC2626',
  },
  {
    id: ALARM_CHANNEL,
    name: 'Other alarms',
    description: 'Every other helmet alarm.',
    importance: 'high',
    sound: 'default',
    vibrationPattern: [0, 250, 150, 250],
    bypassDnd: false,
    alarmVolume: false,
    lightColor: '#D97706',
  },
]

export function channelFor(severity: string | undefined): string {
  return severity === 'critical' ? SOS_CHANNEL : ALARM_CHANNEL
}
