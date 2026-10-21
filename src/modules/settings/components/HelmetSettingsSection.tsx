import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { useEffect, useState } from 'react'
import { Pressable, Switch, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Card, SectionTitle } from '@/shared/components/Card'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { describeSettingsError } from '../lib/errorText'
import { useSaveUnitSettings, useUnitSettings } from '../hooks/useSettings'
import { SPLIT_CHOICES } from '../types'

/**
 * How a helmet splits its recordings into clips. Needs UNIT_SETTING to see and
 * UNIT_SETTING_MANAGE to change.
 *
 * Settings reach the helmet straight away but only apply when it restarts, and the backend's
 * "apply now" only makes the helmet reconnect (it doesn't reload settings), so there is
 * deliberately no such button here.
 */
export function HelmetSettingsSection({ id }: { id: string }) {
  const brand = useBrandColours()
  const canWrite = useCan('unitSettings:write')
  const settings = useUnitSettings(id)
  const save = useSaveUnitSettings(id)

  const [splitting, setSplitting] = useState<boolean | undefined>(undefined)
  const [minutes, setMinutes] = useState<number | undefined>(undefined)
  const [note, setNote] = useState<string | null>(null)

  // Take the helmet's values once they load (and again after a save changes them).
  useEffect(() => {
    if (settings.data) {
      setSplitting(settings.data.videoSplitting)
      setMinutes(settings.data.videoSplitMinutes)
    }
  }, [settings.data])

  if (isForbidden(settings.error)) return null
  if (settings.isLoading || !settings.data) return null

  const dirty = splitting !== settings.data.videoSplitting || minutes !== settings.data.videoSplitMinutes
  // A length set some other way (the backend takes any 1-60) still shows, as its own chip.
  const choices = [...SPLIT_CHOICES] as number[]
  if (minutes !== undefined && !choices.includes(minutes)) choices.push(minutes)

  async function onSave() {
    setNote(null)
    try {
      const result = await save.mutateAsync({ videoSplitting: splitting, videoSplitMinutes: minutes })
      setNote(
        result.delivered
          ? 'Saved. Takes effect after the helmet restarts.'
          : "Saved, but the helmet hasn't received it yet. It takes effect after the helmet restarts."
      )
    } catch {
      /* shown below from save.error */
    }
  }

  return (
    <>
      <SectionTitle>Video recording</SectionTitle>
      <Card className="mb-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-sans-medium">Split recordings into clips</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {splitting
                ? `A new clip every ${minutes ?? '—'} minutes.`
                : 'One long recording, with no splitting.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Split recordings into clips"
            value={!!splitting}
            disabled={!canWrite || save.isPending}
            onValueChange={(on) => {
              setSplitting(on)
              setNote(null)
            }}
            trackColor={{ false: '#CBD5E1', true: brand.primary }}
          />
        </View>

        {splitting ? (
          <View className="mt-4">
            <Text className="mb-2 text-xs text-slate-500">Clip length</Text>
            <View className="flex-row flex-wrap gap-2">
              {choices.map((m) => {
                const on = minutes === m
                return (
                  <Pressable
                    key={m}
                    hitSlop={6}
                    disabled={!canWrite || save.isPending}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setMinutes(m)
                      setNote(null)
                    }}
                    className={cn(
                      'rounded-full border px-4 py-2',
                      on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white'
                    )}
                  >
                    <Text className={cn('font-sans-medium text-sm', on ? 'text-white' : 'text-slate-700')}>
                      {m} min
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        {canWrite ? (
          <>
            <Button
              title="Save"
              className="mt-4"
              loading={save.isPending}
              disabled={!dirty}
              onPress={() => void onSave()}
            />
            <Text className="mt-3 text-xs leading-5 text-slate-500">
              Settings take effect after the helmet restarts. Once settings are saved for a helmet, its
              spoken alarm prompts follow them (on by default).
            </Text>
          </>
        ) : (
          <Text className="mt-3 text-xs leading-5 text-slate-500">Your role can view these settings but not change them.</Text>
        )}

        {note ? <Text className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-900">{note}</Text> : null}
        {save.isError ? <Text className="mt-3 text-sm text-red-600">{describeSettingsError(save.error)}</Text> : null}
      </Card>
    </>
  )
}
