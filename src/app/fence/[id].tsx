import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { EmptyState, LoadingState } from '@/shared/components/States'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { useLayout } from '@/shared/lib/layout'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { fenceErrorMessage, toDraft } from '@/modules/fences/api/fences.api'
import type { ClipFile } from '@/modules/fences/lib/clip'
import { pickClip } from '@/modules/fences/lib/pickClip'
import { FenceForm } from '@/modules/fences/components/FenceForm'
import { useFences, useSaveFence } from '@/modules/fences/hooks/useFences'
import { EMPTY_DRAFT, type FenceDraft } from '@/modules/fences/types'
import { MapSurface } from '@/modules/map/components/MapSurface'
import { toMapDraft, toMapFence } from '@/modules/map/lib/mapData'

function FenceEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === 'new'
  const { height, twoPane } = useLayout()
  const { fences, isLoading } = useFences()
  const { devices } = useDeviceViews()
  const save = useSaveFence()

  // A fence saved a moment ago whose clip then failed: from here on it is an edit, never a second create.
  const [savedId, setSavedId] = useState<number | undefined>(undefined)
  const existing = fences.find((f) => String(f.id) === (isNew ? String(savedId) : id))
  const [clip, setClip] = useState<ClipFile | null>(null)
  const [clipRemoved, setClipRemoved] = useState(false)
  const [clipError, setClipError] = useState<string | null>(null)
  const [draft, setDraft] = useState<FenceDraft | null>(isNew ? EMPTY_DRAFT : null)
  const [fitKey, setFitKey] = useState(0)

  // Editing starts from the saved fence once the list has loaded.
  useEffect(() => {
    if (!draft && existing) setDraft(toDraft(existing))
  }, [draft, existing])
  // Once the shape is known, frame it (a new fence frames the existing ones instead).
  useEffect(() => {
    if (draft && fitKey === 0) setFitKey(1)
  }, [draft, fitKey])

  const patch = (changes: Partial<FenceDraft>) => setDraft((d) => (d ? { ...d, ...changes } : d))

  // The other fences stay visible for context, faded and not tappable.
  const others = useMemo(() => fences.filter((f) => f.id !== existing?.id).map(toMapFence), [fences, existing?.id])
  const mapDraft = useMemo(() => (draft ? toMapDraft(draft) : null), [draft])

  async function onPickClip() {
    const picked = await pickClip()
    if (!picked) return
    if ('error' in picked) {
      setClipError(picked.error)
      return
    }
    setClipError(null)
    setClipRemoved(false)
    setClip(picked.clip)
  }

  async function onSave() {
    if (!draft) return
    setClipError(null)
    try {
      // new file to attach, null to remove the current clip, undefined to leave it as it is
      const result = await save.mutateAsync({ draft, id: existing?.id ?? savedId, clip: clip ?? (clipRemoved ? null : undefined) })
      if (result.clipError) {
        // The fence is saved; only the clip needs another go. Stay here, and treat further saves as edits.
        setSavedId(result.fence.id)
        setClipError(`The fence was saved, but its clip wasn't: ${result.clipError}`)
        return
      }
      router.back()
    } catch {
      /* the message is shown by the form */
    }
  }

  if (!draft) {
    return (
      <Screen top={false}>
        {isLoading ? <LoadingState /> : <EmptyState icon="help-circle" title="Fence not found" hint="It may have been deleted." />}
      </Screen>
    )
  }

  const map = (
    <MapSurface
      fences={others}
      dimFences
      draft={mapDraft}
      fitKey={fitKey}
      fitTarget={existing ? 'draft' : 'fences'}
      onMapTap={(lat, lng) =>
        setDraft((d) => (d ? (d.type === 'ROUND' ? { ...d, center: { lat, lng } } : { ...d, points: [...d.points, { lat, lng }] }) : d))
      }
      onDraftChange={(change) => patch(change)}
    />
  )

  const form = (
    <ScrollView contentContainerClassName="px-4 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <FenceForm
        draft={draft}
        onChange={patch}
        existing={existing}
        devices={devices}
        saving={save.isPending}
        error={save.isError ? fenceErrorMessage(save.error) : null}
        clip={clip}
        clipRemoved={clipRemoved}
        clipError={clipError}
        onPickClip={() => void onPickClip()}
        onDiscardClip={() => setClip(null)}
        onRemoveClip={(removed) => {
          setClipRemoved(removed)
          if (removed) setClip(null)
        }}
        onSave={() => void onSave()}
        onCancel={() => router.back()}
      />
    </ScrollView>
  )

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: isNew ? 'New fence' : `Edit ${existing?.name ?? 'fence'}` }} />
      {twoPane ? (
        <View className="flex-1 flex-row">
          <View className="flex-1">{map}</View>
          <View className="border-l border-slate-200 bg-slate-50" style={{ width: 440 }}>{form}</View>
        </View>
      ) : (
        <View className="flex-1">
          <View style={{ height: Math.round(Math.max(240, Math.min(height * 0.42, 420))) }}>{map}</View>
          {form}
        </View>
      )}
    </Screen>
  )
}

export default function FenceEditorRoute() {
  return (
    <RequirePermission permission="fences:write" fallback="/more">
      <FenceEditorScreen />
    </RequirePermission>
  )
}
