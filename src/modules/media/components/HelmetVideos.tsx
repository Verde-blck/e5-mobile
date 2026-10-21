import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useCan } from '@/shared/lib/permissions'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { fetchHelmetVideos, refreshAndWait, requestHelmetUpload } from '../api/localVideos.api'
import type { HelmetVideoReport } from '../api/localVideos.api'

const RANGES = [
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

type Phase = 'idle' | 'refreshing' | 'offline' | 'no-report' | 'ready'

function formatRecorded(at: number | null): string {
  return at == null ? '—' : new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Recordings still on a helmet's memory card. Helmets record locally and only some clips reach the server, so this shows
 * what else exists and lets the operator ask for it. Uploads are big (a 5-minute clip is about 100 MB), so nothing uploads
 * without a tap.
 */
export function HelmetVideos() {
  const { devices } = useDeviceViews()
  const queryClient = useQueryClient()
  const canUpload = useCan('videos:write')
  const [deviceId, setDeviceId] = useState('')
  const [days, setDays] = useState(7)
  const [phase, setPhase] = useState<Phase>('idle')
  const [report, setReport] = useState<HelmetVideoReport | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const device = devices.find((d) => d.id === deviceId)
  const pending = report?.files.filter((f) => !f.uploaded && f.uploadRequestedAt != null) ?? []
  const notUploaded = report?.files.filter((f) => !f.uploaded && f.uploadRequestedAt == null) ?? []

  useEffect(() => () => abort.current?.abort(), [])

  // While uploads are on their way, check every 10 s. When a clip arrives, refresh the recordings list so it shows up there and on the calendar.
  useEffect(() => {
    if (!deviceId || pending.length === 0) return
    const id = setInterval(async () => {
      const next = await fetchHelmetVideos(deviceId).catch(() => null)
      if (!next) return
      setReport((prev) => {
        const arrived = next.files.some((f) => f.uploaded && prev?.files.find((p) => p.fileName === f.fileName && !p.uploaded))
        if (arrived) void queryClient.invalidateQueries({ queryKey: ['media'] })
        return next
      })
    }, 10_000)
    return () => clearInterval(id)
  }, [deviceId, pending.length, queryClient])

  async function refresh() {
    if (!deviceId) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setError(null)
    setPhase('refreshing')
    try {
      const { delivered, report: next } = await refreshAndWait(deviceId, days, controller.signal)
      if (controller.signal.aborted) return
      if (!delivered) setPhase('offline')
      else if (!next) setPhase('no-report')
      else {
        setReport(next)
        setPhase('ready')
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Couldn't reach the server. Check your connection and try again.")
        setPhase('idle')
      }
    }
  }

  async function upload(target: { files: string[] } | { all: true }) {
    if (!deviceId) return
    setBusy('all' in target ? 'all' : target.files[0])
    setError(null)
    try {
      await requestHelmetUpload(deviceId, target)
      // Reflect the request straight away rather than waiting for a poll.
      const requested = Date.now()
      setReport((prev) => (prev ? { ...prev, files: prev.files.map((f) => (!f.uploaded && ('all' in target || target.files.includes(f.fileName)) ? { ...f, uploadRequestedAt: f.uploadRequestedAt ?? requested } : f)) } : prev))
    } catch {
      setError("Couldn't send the upload request. Try again.")
    } finally {
      setBusy(null)
    }
  }

  const chip = (on: boolean) => cn('min-h-9 justify-center rounded-full border px-3', on ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white active:bg-slate-50')

  return (
    <View className="gap-3">
      <View className="gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <View>
          <Text className="mb-1.5 text-xs text-slate-500">Helmet</Text>
          <View className="flex-row flex-wrap gap-2">
            {devices.map((d) => (
              <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={`${d.name}${d.presence === 'offline' ? ' (offline)' : ''}`} aria-pressed={d.id === deviceId} onPress={() => { setDeviceId(d.id); setReport(null); setPhase('idle') }} className={chip(d.id === deviceId)}>
                <Text className={cn('text-xs', d.id === deviceId ? 'font-sans-semibold text-slate-900' : 'text-slate-600')}>{d.name}{d.presence === 'offline' ? ' (offline)' : ''}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text className="mb-1.5 text-xs text-slate-500">Look back</Text>
          <View className="flex-row flex-wrap gap-2">
            {RANGES.map((r) => (
              <Pressable key={r.days} accessibilityRole="button" accessibilityLabel={r.label} aria-pressed={r.days === days} onPress={() => setDays(r.days)} className={chip(r.days === days)}>
                <Text className={cn('text-xs', r.days === days ? 'font-sans-semibold text-slate-900' : 'text-slate-600')}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Button title={phase === 'refreshing' ? 'Asking the helmet…' : 'Refresh'} icon="refresh-cw" disabled={!deviceId || phase === 'refreshing'} onPress={() => void refresh()} />
        <Text className="text-[11px] leading-4 text-slate-400">Clips are about 100 MB per 5 minutes, so uploading over a phone hotspot uses a lot of data. Site Wi-Fi is better.</Text>
      </View>

      {!deviceId ? <Text className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Choose a helmet and press Refresh to see the recordings still on its memory card.</Text> : null}
      {deviceId && phase === 'idle' && !report ? <Text className="text-sm text-slate-500">Press Refresh to ask {device?.name ?? 'the helmet'} what it has.</Text> : null}
      {phase === 'refreshing' ? <Text accessibilityLiveRegion="polite" className="text-sm text-slate-500">Asking the helmet for its list. This takes about 5 to 10 seconds.</Text> : null}
      {phase === 'offline' ? <Text className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{device?.name ?? 'The helmet'} is offline, so it can't report what's on its card. Try again once it's online.</Text> : null}
      {phase === 'no-report' ? <Text className="text-sm text-amber-800">The helmet didn't answer within 30 seconds. It may have a weak connection; try again.</Text> : null}
      {error ? <Text accessibilityRole="alert" className="text-sm text-red-600">{error}</Text> : null}

      {report && phase !== 'refreshing' ? (
        <View className="rounded-xl border border-slate-200 bg-white">
          <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <Text className="text-xs text-slate-500">
              {report.files.length} {report.files.length === 1 ? 'clip' : 'clips'} on the card · {report.files.filter((f) => f.uploaded).length} already uploaded{pending.length > 0 ? ` · ${pending.length} uploading` : ''}
            </Text>
            {canUpload && notUploaded.length > 0 ? <Button title={busy === 'all' ? 'Requesting…' : `Upload all ${notUploaded.length}`} variant="secondary" className="h-9" disabled={busy !== null} onPress={() => void upload({ all: true })} /> : null}
          </View>
          {report.files.length === 0 ? (
            <Text className="px-4 py-6 text-center text-sm text-slate-500">No recordings in that period.</Text>
          ) : (
            report.files.map((f, i) => (
              <View key={f.fileName} className={cn('flex-row flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5', i > 0 && 'border-t border-slate-100')}>
                <Text className="font-mono text-xs text-slate-600">{f.fileName}</Text>
                <Text className="text-xs text-slate-500">{formatRecorded(f.recordedAt)}</Text>
                <View className="ml-auto flex-row items-center gap-2">
                  {f.uploaded ? (
                    <View className="rounded bg-emerald-50 px-1.5 py-0.5"><Text className="text-[11px] text-emerald-700">Uploaded</Text></View>
                  ) : f.uploadRequestedAt != null ? (
                    <View className="rounded bg-sky-50 px-1.5 py-0.5"><Text className="text-[11px] text-sky-700">Uploading…</Text></View>
                  ) : (
                    <>
                      <View className="rounded bg-slate-100 px-1.5 py-0.5"><Text className="text-[11px] text-slate-600">On helmet only</Text></View>
                      {canUpload ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Upload ${f.fileName}`} disabled={busy !== null} onPress={() => void upload({ files: [f.fileName] })} hitSlop={8} className="px-1 py-1">
                          <Text className="text-xs font-sans-semibold text-brand-primary">{busy === f.fileName ? 'Requesting…' : 'Upload'}</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            ))
          )}
          {pending.length > 0 ? <Text className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Uploads can take several minutes. Finished clips appear in Uploaded and on the calendar.</Text> : null}
        </View>
      ) : null}
    </View>
  )
}
