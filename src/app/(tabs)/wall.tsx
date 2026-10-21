import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { liveAvailable } from '@/modules/live/api/live.api'
import { FocusView } from '@/modules/live/components/FocusView'
import { WallTile } from '@/modules/live/components/WallTile'
import { useWallSessions } from '@/modules/live/hooks/useWallSessions'
import { WALL_DATA_NOTE, WALL_MAX, toggleSelection, wallColumns } from '@/modules/live/lib/wall'

const DOT = { online: 'bg-emerald-500', degraded: 'bg-amber-400', offline: 'bg-slate-300' } as const
const GAP = 12

/**
 * Up to six helmets live at once, side by side. Every tile is muted; enlarge one to hear it, so there is never more
 * than one helmet talking. Each tile is its own connection, so one weak signal never affects the others. Leaving this
 * screen disconnects from every helmet, and coming back reconnects the same ones.
 */
function LiveWallScreen() {
  const wall = useWallSessions()
  const { devices } = useDeviceViews()
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [gridWidth, setGridWidth] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  const byId = new Map(devices.map((d) => [d.id, d]))
  const needle = search.trim().toLowerCase()
  const shown = needle ? devices.filter((d) => d.name.toLowerCase().includes(needle) || d.id.toLowerCase().includes(needle)) : devices
  const full = selected.length >= WALL_MAX
  const idle = selected.filter((id) => {
    const s = wall.get(id)
    return !s || s.getState().status === 'ended'
  })
  const columns = wallColumns(gridWidth)
  const tileWidth = gridWidth ? Math.floor((gridWidth - GAP * (columns - 1)) / columns) : 0
  const focused = focusId ? byId.get(focusId) : undefined

  function toggle(device: { id: string; name: string; active: boolean }) {
    const result = toggleSelection(selected, device)
    if (result.blocked) {
      setNote(result.blocked === 'full' ? `The wall holds ${WALL_MAX} helmets. Remove one first.` : `${device.name} is deactivated.`)
      return
    }
    setNote(null)
    setSelected(result.selected)
    if (result.selected.includes(device.id)) wall.start(device.id)
    else {
      wall.stop(device.id)
      if (focusId === device.id) setFocusId(null)
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-0">
        <Container max={1100}>
          <PageTitle title="Live wall" padded={false} />
          <View className="rounded-xl border border-slate-200 bg-white p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="min-w-0 flex-1 text-sm text-slate-700">
                <Text className="font-sans-semibold text-sm">{selected.length} of {WALL_MAX}</Text> helmets on the wall
              </Text>
              <View className="flex-row gap-2">
                {idle.length > 0 ? <Button title="Start all" icon="play" className="h-10" onPress={() => idle.forEach((id) => wall.start(id))} /> : null}
                {selected.some((id) => wall.get(id)) ? <Button title="Stop all" variant="secondary" icon="square" className="h-10" onPress={() => { wall.stopAll(); setFocusId(null) }} /> : null}
              </View>
            </View>
            <Text className="mb-3 mt-1 text-xs text-slate-400">{WALL_DATA_NOTE}</Text>
            <TextField label="Find a helmet" value={search} onChangeText={setSearch} placeholder="Name or number" autoCapitalize="none" autoCorrect={false} />
            {note ? <Text accessibilityRole="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{note}</Text> : null}
            <View className="mt-3 flex-row flex-wrap gap-2">
              {devices.length === 0 ? <Text className="text-xs text-slate-500">Loading fleet…</Text> : null}
              {devices.length > 0 && shown.length === 0 ? <Text className="text-xs text-slate-500">No helmets match that search.</Text> : null}
              {shown.map((d) => {
                const on = selected.includes(d.id)
                const blocked = !on && (full || !d.active)
                return (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    accessibilityLabel={d.name}
                    accessibilityState={{ selected: on, disabled: blocked }}
                    aria-pressed={on}
                    onPress={() => toggle(d)}
                    className={cn('min-h-10 flex-row items-center gap-2 rounded-full border px-3', on ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white active:bg-slate-50')}
                    style={{ opacity: blocked ? 0.4 : 1 }}
                  >
                    <View className={cn('h-2 w-2 rounded-full', DOT[d.presence])} />
                    <Text className={cn('text-xs', on ? 'font-sans-semibold text-slate-900' : 'text-slate-600')}>{d.name}</Text>
                    {on ? <Text className="text-xs text-brand-primary">✓</Text> : null}
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View className="mt-4" onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {selected.length === 0 ? (
              <Text className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Pick up to {WALL_MAX} helmets above to watch them live side by side.
              </Text>
            ) : tileWidth > 0 ? (
              <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                {selected.map((id) => {
                  const device = byId.get(id)
                  return (
                    <WallTile
                      key={id}
                      name={device?.name ?? id}
                      session={wall.get(id)}
                      width={tileWidth}
                      onStart={() => wall.start(id)}
                      onRemove={() => device && toggle(device)}
                      onFocus={() => setFocusId(id)}
                    />
                  )
                })}
              </View>
            ) : null}
          </View>
        </Container>
      </ScrollView>

      {focused ? <FocusView name={focused.name} session={wall.get(focused.id)} onClose={() => setFocusId(null)} /> : null}
    </Screen>
  )
}

export default function LiveWallRoute() {
  return (
    <RequirePermission permission="live:read" fallback="/more">
      {liveAvailable() ? (
        <LiveWallScreen />
      ) : (
        <Screen>
          <PageTitle title="Live wall" />
          <Text className="mx-4 rounded-xl bg-slate-100 p-4 text-sm leading-5 text-slate-600">The live wall isn't switched on in this build yet.</Text>
        </Screen>
      )}
    </RequirePermission>
  )
}
