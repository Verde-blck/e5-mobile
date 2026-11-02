import type { IconName } from '@/shared/constants/modules'
import type { Alarm, AlarmType } from '../types'

export const ALARM_ICONS: Record<AlarmType, IconName> = {
  sos: 'alert-octagon',
  'sos-button': 'phone-call',
  fall: 'trending-down',
  'helmet-removal': 'user-x',
  geofence: 'map-pin',
  'restricted-area': 'slash',
  temperature: 'thermometer',
  silent: 'moon',
  'near-electric': 'zap',
  ascending: 'arrow-up',
  'beacon-enter': 'radio',
  'beacon-leave': 'radio',
  'body-temperature': 'thermometer',
  'heart-rate': 'heart',
  'blood-pressure': 'activity',
  'voice-message': 'mic',
  'gas-co': 'cloud',
  'gas-h2s': 'droplet',
  'gas-ch4': 'alert-triangle',
  'gas-o2-low': 'wind',
  other: 'bell',
}

// Red and amber are reserved for alarms, which is why the brand orange is kept out of the UI chrome.
export function alarmTone(alarm: Pick<Alarm, 'severity' | 'status'>) {
  if (alarm.status === 'resolved') {
    return { bg: 'bg-slate-100', icon: '#64748B', pill: 'bg-emerald-50', pillText: 'text-emerald-800', label: 'Resolved' }
  }
  return alarm.severity === 'critical'
    ? { bg: 'bg-red-50', icon: '#DC2626', pill: 'bg-red-50', pillText: 'text-red-800', label: 'Active' }
    : { bg: 'bg-amber-50', icon: '#D97706', pill: 'bg-amber-50', pillText: 'text-amber-800', label: 'Active' }
}
