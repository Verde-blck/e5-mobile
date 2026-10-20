import { useEffect, useState } from 'react'
import { Pressable, Switch, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import type { DeviceView } from '@/modules/devices/types'
import { formatBytes, type ClipFile } from '../lib/clip'
import { describePeriod, isTooSmall, narrowestAcrossM, validateDraft } from '../lib/geometry'
import { AudioPreview } from '@/shared/components/AudioPreview'
import { BEHAVIOR_LABEL, FREQUENCIES, MIN_FENCE_ACROSS_M, type Fence, type FenceBehavior, type FenceDraft } from '../types'

/** "0830" -> "08:30": digits only, the colon added for you. */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

function formatSeconds(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 font-sans-medium text-sm text-slate-700">{children}</Text>
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      className={cn('rounded-full border px-3.5 py-2', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white')}
    >
      <Text className={cn('font-sans-medium text-sm', on ? 'text-white' : 'text-slate-700')}>{label}</Text>
    </Pressable>
  )
}

interface Props {
  draft: FenceDraft
  onChange: (patch: Partial<FenceDraft>) => void
  /** The saved fence when editing; undefined for a new one. */
  existing?: Fence
  devices: DeviceView[]
  saving: boolean
  error: string | null
  /** A new clip chosen but not saved yet. */
  clip: ClipFile | null
  /** The attached clip is to be removed when saved. */
  clipRemoved: boolean
  clipError: string | null
  onPickClip: () => void
  /** The tablet's own recorder: active while recording, with seconds so far and the limit. */
  recording: { active: boolean; seconds: number; limit: number; error: string | null }
  onRecord: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onDiscardClip: () => void
  onRemoveClip: (removed: boolean) => void
  onSave: () => void
  onCancel: () => void
}

/** The fence's details. Its shape is drawn on the map beside or above this. */
export function FenceForm({ draft, onChange, existing, devices, saving, error, clip, clipRemoved, clipError, onPickClip, recording, onRecord, onStopRecording, onCancelRecording, onDiscardClip, onRemoveClip, onSave, onCancel }: Props) {
  const [showProblems, setShowProblems] = useState(false)
  const [radiusText, setRadiusText] = useState(String(Math.round(draft.radiusMeters)))

  // A radius changed some other way (the stepper buttons) shows here too.
  useEffect(() => {
    setRadiusText((current) => (Number(current) === Math.round(draft.radiusMeters) ? current : String(Math.round(draft.radiusMeters))))
  }, [draft.radiusMeters])

  const problems = validateDraft(draft)
  const across = narrowestAcrossM(draft)
  const allHelmets = draft.deviceIds.length === 0

  function save() {
    if (problems.length) {
      setShowProblems(true)
      return
    }
    onSave()
  }

  function setPeriod(index: number, patch: Partial<{ start: string; end: string }>) {
    onChange({ validPeriods: draft.validPeriods.map((p, i) => (i === index ? { ...p, ...patch } : p)) })
  }

  return (
    <View className="gap-6">
      <TextField label="Name" value={draft.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. Site A work area" />

      {/* shape */}
      <View>
        <Label>Shape</Label>
        <View className="flex-row gap-2">
          {(['ROUND', 'POLYGON'] as const).map((shape) => (
            <Chip
              key={shape}
              label={shape === 'ROUND' ? 'Circle' : 'Polygon'}
              on={draft.type === shape}
              onPress={() => shape !== draft.type && onChange({ type: shape, center: null, points: [] })}
            />
          ))}
        </View>

        <View className="mt-3 rounded-xl bg-slate-100 p-3">
          {draft.type === 'ROUND' ? (
            draft.center ? (
              <View className="gap-3">
                <Text className="text-sm leading-5 text-slate-600">Tap the map to move the circle, or drag its handle.</Text>
                <View className="flex-row items-end gap-2">
                  <View className="flex-1">
                    <TextField
                      label="Radius (metres)"
                      value={radiusText}
                      keyboardType="number-pad"
                      mono
                      onChangeText={(text) => {
                        const clean = text.replace(/\D/g, '')
                        setRadiusText(clean)
                        if (Number(clean) > 0) onChange({ radiusMeters: Number(clean) })
                      }}
                    />
                  </View>
                  <Button title="−50 m" variant="secondary" className="h-12 px-4" onPress={() => onChange({ radiusMeters: Math.max(10, Math.round(draft.radiusMeters) - 50) })} />
                  <Button title="+50 m" variant="secondary" className="h-12 px-4" onPress={() => onChange({ radiusMeters: Math.round(draft.radiusMeters) + 50 })} />
                </View>
                <Pressable hitSlop={8} onPress={() => onChange({ center: null })}>
                  <Text className="text-sm text-slate-600 underline">Place again</Text>
                </Pressable>
              </View>
            ) : (
              <Text className="font-sans-medium text-sm text-slate-700">Tap the map to place the centre.</Text>
            )
          ) : (
            <View className="gap-2">
              <Text className={cn('text-sm leading-5', draft.points.length < 3 ? 'font-sans-medium text-slate-700' : 'text-slate-600')}>
                {draft.points.length < 3
                  ? `Tap the map to add corners: ${draft.points.length} of at least 3.`
                  : `${draft.points.length} corners. Drag a corner to move it, or tap the map to add another.`}
              </Text>
              {draft.points.length > 0 ? (
                <View className="flex-row gap-5">
                  <Pressable hitSlop={8} onPress={() => onChange({ points: draft.points.slice(0, -1) })}>
                    <Text className="text-sm text-slate-600 underline">Undo last corner</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => onChange({ points: [] })}>
                    <Text className="text-sm text-slate-600 underline">Clear</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {isTooSmall(draft) && across !== null ? (
          <Text className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900">
            This fence is about {Math.round(across)} m across. GPS can drift 10 to 50 m indoors or on a weak signal, so
            fences under {MIN_FENCE_ACROSS_M} m across tend to raise false alarms.
          </Text>
        ) : null}
      </View>

      {/* behaviour */}
      <View>
        <Label>Type</Label>
        <View className="gap-2">
          {(['FORBIDDEN_TO_LEAVE', 'NO_ENTRY'] as FenceBehavior[]).map((b) => (
            <Pressable
              key={b}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.behavior === b }}
              onPress={() => onChange({ behavior: b })}
              className={cn('rounded-xl border p-3', draft.behavior === b ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white')}
            >
              <View className="flex-row items-center gap-2">
                <View className={cn('h-3 w-3 rounded-sm', b === 'NO_ENTRY' ? 'bg-amber-500' : 'bg-brand-primary')} />
                <Text className="font-sans-semibold text-sm">{BEHAVIOR_LABEL[b].short}</Text>
              </View>
              <Text className="mt-0.5 text-sm text-slate-500">{BEHAVIOR_LABEL[b].long}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* repeat */}
      <View>
        <Label>Repeat the alarm while in breach</Label>
        <View className="flex-row flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Chip key={f.value} label={f.value === 0 ? 'Every report' : `${f.value} min`} on={draft.frequencyMinutes === f.value} onPress={() => onChange({ frequencyMinutes: f.value })} />
          ))}
        </View>
        {draft.frequencyMinutes === 0 ? (
          <Text className="mt-1.5 text-xs leading-5 text-slate-500">Every report is about every 10 seconds, which can be a lot of alarms.</Text>
        ) : null}
      </View>

      {/* hours */}
      <View>
        <Label>Active hours (Lagos time)</Label>
        {draft.validPeriods.length === 0 ? (
          <Text className="text-sm text-slate-500">Always active.</Text>
        ) : (
          <View className="gap-2">
            {draft.validPeriods.map((p, i) => (
              <View key={i} className="flex-row items-end gap-2">
                <View className="flex-1">
                  <TextField label={`Hours ${i + 1} start`} value={p.start} mono placeholder="08:00" keyboardType="number-pad" maxLength={5} onChangeText={(v) => setPeriod(i, { start: formatTimeInput(v) })} />
                </View>
                <View className="flex-1">
                  <TextField label={`Hours ${i + 1} end`} value={p.end} mono placeholder="17:00" keyboardType="number-pad" maxLength={5} onChangeText={(v) => setPeriod(i, { end: formatTimeInput(v) })} />
                </View>
                <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove hours ${i + 1}`} onPress={() => onChange({ validPeriods: draft.validPeriods.filter((_, j) => j !== i) })} className="h-12 w-10 items-center justify-center">
                  <Feather name="x" size={20} color="#64748B" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Pressable hitSlop={8} className="mt-2" onPress={() => onChange({ validPeriods: [...draft.validPeriods, { start: '08:00', end: '17:00' }] })}>
          <Text className="font-sans-semibold text-sm text-brand-primary">{draft.validPeriods.length ? 'Add more hours' : 'Limit to certain hours'}</Text>
        </Pressable>
        {draft.validPeriods.length > 0 ? <Text className="mt-1 text-xs text-slate-500">Active {draft.validPeriods.map(describePeriod).join(', ')}.</Text> : null}
      </View>

      {/* helmets */}
      <View>
        <Label>Helmets</Label>
        <View className="flex-row gap-2">
          <Chip label="Every helmet" on={allHelmets} onPress={() => onChange({ deviceIds: [] })} />
          <Chip label="Chosen helmets" on={!allHelmets} onPress={() => devices.length > 0 && onChange({ deviceIds: devices.slice(0, 1).map((d) => d.id) })} />
        </View>
        {!allHelmets ? (
          <View className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {devices.map((d, i) => {
              const on = draft.deviceIds.includes(d.id)
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  // react-native-web doesn't write aria-checked from accessibilityState.
                  aria-checked={on}
                  accessibilityLabel={d.name}
                  onPress={() => {
                    const next = on ? draft.deviceIds.filter((id) => id !== d.id) : [...draft.deviceIds, d.id]
                    // Unticking the last one would silently mean "every helmet".
                    if (next.length > 0) onChange({ deviceIds: next })
                  }}
                  className={cn('min-h-12 flex-row items-center gap-3 px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100')}
                >
                  <View className={cn('h-5 w-5 items-center justify-center rounded border', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300')}>
                    {on ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text className="flex-1 text-sm" numberOfLines={1}>{d.name}</Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </View>

      {/* warning clip */}
      <View>
        <Label>Warning played on the helmet</Label>
        <Text className="mb-2 text-xs leading-5 text-slate-500">Played when a breach is detected, for example "You have left the work area."</Text>

        {clip ? (
          <View className="gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <View className="flex-row items-center gap-2">
              <Feather name="music" size={16} color="#0A6659" />
              <Text className="flex-1 text-sm" numberOfLines={1}>{clip.name}</Text>
              {clip.size != null || clip.file ? <Text className="text-xs text-slate-500">{formatBytes(clip.file?.size ?? clip.size ?? 0)}</Text> : null}
            </View>
            <AudioPreview uri={clip.uri} />
            <Pressable hitSlop={8} onPress={onDiscardClip}>
              <Text className="text-sm text-slate-600 underline">Discard new clip</Text>
            </Pressable>
          </View>
        ) : existing?.hasWarningAudio && !clipRemoved ? (
          <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <Text className="flex-1 text-sm text-slate-700">A warning clip is attached.</Text>
            <Pressable hitSlop={8} onPress={() => onRemoveClip(true)}>
              <Text className="text-sm text-slate-600 underline">Remove</Text>
            </Pressable>
          </View>
        ) : clipRemoved ? (
          <Text className="text-sm text-slate-600">
            The current clip will be removed when you save.{' '}
            <Text className="text-sm underline" onPress={() => onRemoveClip(false)}>Keep it</Text>
          </Text>
        ) : (
          <Text className="text-sm text-slate-600">No warning clip is attached.</Text>
        )}

        {recording.active ? (
          <View className="mt-2 gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full bg-red-600" />
              <Text className="flex-1 font-sans-semibold text-sm text-red-800">Recording…</Text>
              <Text className="font-mono text-sm text-red-800">{formatSeconds(recording.seconds)} / {formatSeconds(recording.limit)}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button title="Stop" icon="square" className="h-11 flex-1" onPress={onStopRecording} />
              <Button title="Cancel recording" variant="secondary" className="h-11 flex-1" onPress={onCancelRecording} />
            </View>
          </View>
        ) : !clip ? (
          <View className="mt-2 gap-2">
            <Button
              variant="secondary"
              icon="mic"
              title={existing?.hasWarningAudio && !clipRemoved ? 'Record a replacement' : 'Record a clip'}
              onPress={onRecord}
            />
            <Button
              variant="secondary"
              icon="upload"
              title={existing?.hasWarningAudio && !clipRemoved ? 'Choose a replacement file' : 'Choose an audio file'}
              onPress={onPickClip}
            />
          </View>
        ) : null}
        {recording.error ? <Text className="mt-2 text-sm text-red-600">{recording.error}</Text> : null}
        {clipError ? <Text className="mt-2 text-sm text-red-600">{clipError}</Text> : null}
        <Text className="mt-2 text-xs leading-5 text-slate-500">Up to 5 MB. MP3, WAV or M4A; a recording is converted to MP3 for the helmet.</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-base">Fence is on</Text>
        <Switch accessibilityLabel="Fence is on" value={draft.active} onValueChange={(active) => onChange({ active })} trackColor={{ false: '#CBD5E1', true: '#0A6659' }} />
      </View>

      {showProblems && problems.length > 0 ? (
        <View accessibilityRole="alert" className="gap-1 rounded-xl bg-red-50 p-3">
          {problems.map((p) => (
            <Text key={p} className="text-sm text-red-700">{p}</Text>
          ))}
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</Text> : null}

      <View className="gap-2 border-t border-slate-200 pt-4">
        <Button title={existing ? 'Save changes' : 'Create fence'} loading={saving} onPress={save} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  )
}
