import { useState } from 'react'
import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { runPushSetup } from '../hooks/usePushSetup'
import { describeStatus } from '../lib/describe'
import { notifications } from '../lib/notifications'
import { usePushStore } from '../store/pushStore'

export function perform(action: 'enable' | 'settings' | 'retry' | undefined) {
  if (action === 'settings') void notifications.openSettings()
  else if (action === 'enable' || action === 'retry') void runPushSetup(true)
}

const TONE = {
  ok: { box: 'bg-emerald-50', text: 'text-emerald-900', icon: '#047857', name: 'check-circle' },
  warn: { box: 'bg-amber-50', text: 'text-amber-900', icon: '#B45309', name: 'alert-triangle' },
  info: { box: 'bg-slate-100', text: 'text-slate-700', icon: '#475569', name: 'info' },
} as const

/**
 * Where alarm alerts stand on this tablet, with the one thing to do about it, a way to test it,
 * and the battery setting that decides whether a locked tablet can really be woken.
 */
export function AlertsCard() {
  const status = usePushStore((s) => s.status)
  const copy = describeStatus(status)
  const tone = TONE[copy.tone]
  const [note, setNote] = useState<string | null>(null)
  const supported = notifications.isSupported()

  async function sendTest() {
    setNote(null)
    let permission = await notifications.permission()
    if (permission === 'undetermined') permission = await notifications.requestPermission()
    if (permission !== 'granted') {
      setNote("Notifications are blocked, so the test can't be shown. Allow them in the tablet's settings first.")
      return
    }
    await notifications.setup()
    await notifications.sendTest()
    setNote('A test alert will arrive in 5 seconds. Lock the screen now to test it the way a real alarm would arrive.')
  }

  return (
    <Card>
      <View className={cn('flex-row gap-3 rounded-xl p-3', tone.box)}>
        <Feather name={tone.name} size={20} color={tone.icon} />
        <View className="flex-1">
          <Text className={cn('font-sans-semibold', tone.text)}>{copy.title}</Text>
          <Text className={cn('mt-0.5 text-sm leading-5', tone.text)}>{copy.detail}</Text>
        </View>
      </View>

      {copy.action ? (
        <Button
          className="mt-3"
          title={copy.action === 'settings' ? 'Open settings' : copy.action === 'retry' ? 'Try again' : 'Turn on alerts'}
          icon={copy.action === 'settings' ? 'settings' : copy.action === 'retry' ? 'refresh-cw' : 'bell'}
          onPress={() => perform(copy.action)}
        />
      ) : null}

      {supported ? (
        <View className="mt-3 gap-2 border-t border-slate-100 pt-3">
          <Button title="Send a test alert" variant="secondary" icon="volume-2" onPress={() => void sendTest()} />
          {note ? <Text className="text-xs leading-5 text-slate-600">{note}</Text> : null}
          <Button title="Battery settings" variant="ghost" icon="battery" onPress={() => void notifications.openBatterySettings()} />
          <Text className="text-xs leading-5 text-slate-500">
            On some tablets, battery saving stops apps from waking a locked screen. Set this app to "Unrestricted" or "Don't optimise" so alarms get through.
          </Text>
        </View>
      ) : null}
    </Card>
  )
}
