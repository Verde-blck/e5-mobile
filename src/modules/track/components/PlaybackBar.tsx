import { useEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { Track } from '../types'
import { Scrubber } from './Scrubber'

export const SPEEDS = [1, 4, 16, 64] as const

// Fixes are irregularly spaced, so playback steps point to point (every
// position shown is a real reading, never a guess between two).
export function playbackPace(speed: number): { tickMs: number; step: number } {
  const pointsPerSecond = Math.min(speed * 2, 120)
  const tickMs = Math.max(66, 1000 / pointsPerSecond)
  return { tickMs, step: Math.max(1, Math.round((pointsPerSecond * tickMs) / 1000)) }
}

export function PlaybackBar({
  track,
  cursor,
  setCursor,
  playing,
  setPlaying,
  speed,
  setSpeed,
}: {
  track: Track
  cursor: number
  setCursor: (next: number) => void
  playing: boolean
  setPlaying: (next: boolean) => void
  speed: number
  setSpeed: (next: number) => void
}) {
  const last = track.points.length - 1
  const point = track.points[cursor]

  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  useEffect(() => {
    if (!playing) return
    const { tickMs, step } = playbackPace(speed)
    const id = setInterval(() => {
      const next = Math.min(last, cursorRef.current + step)
      setCursor(next)
      if (next >= last) setPlaying(false)
    }, tickMs)
    return () => clearInterval(id)
  }, [playing, speed, last, setCursor, setPlaying])

  if (!point) return null

  return (
    <View className="select-none rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          title={playing ? 'Pause' : cursor >= last ? 'Replay' : 'Play'}
          icon={playing ? 'pause' : 'play'}
          className="h-11 px-5"
          onPress={() => {
            if (cursor >= last) setCursor(0)
            setPlaying(!playing)
          }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Previous point" hitSlop={6} onPress={() => { setPlaying(false); setCursor(Math.max(0, cursor - 1)) }} className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 active:bg-slate-100">
          <Feather name="skip-back" size={16} color="#0C352F" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next point" hitSlop={6} onPress={() => { setPlaying(false); setCursor(Math.min(last, cursor + 1)) }} className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 active:bg-slate-100">
          <Feather name="skip-forward" size={16} color="#0C352F" />
        </Pressable>
        <View className="ml-auto flex-row rounded-xl border border-slate-200 p-0.5">
          {SPEEDS.map((option) => (
            <Pressable key={option} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Speed ${option}×`} accessibilityState={{ selected: speed === option }} onPress={() => setSpeed(option)} className={cn('rounded-lg px-3 py-2', speed === option && 'bg-brand-tint')}>
              <Text className={cn('text-xs', speed === option ? 'font-sans-semibold text-brand-secondary' : 'text-slate-500')}>{option}×</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Scrubber
        value={cursor}
        max={last}
        label="Playback position"
        onChange={(next) => {
          setPlaying(false)
          setCursor(next)
        }}
      />

      <Text className="text-xs text-slate-500">
        {new Date(point.ts).toLocaleString()} · point {cursor + 1} of {last + 1}
      </Text>
      <View className="mt-1 flex-row flex-wrap gap-x-4 gap-y-0.5">
        <Text className="font-mono text-[11px] text-slate-500">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </Text>
        {point.altitude != null ? <Text className="text-[11px] text-slate-500">Altitude {point.altitude} m</Text> : null}
        {point.batteryPercent != null ? <Text className="text-[11px] text-slate-500">Battery {point.batteryPercent}%</Text> : null}
        <Text className="text-[11px] text-slate-500">Speed {point.speedMps.toFixed(1)} m/s</Text>
        {point.approximate ? <Text className="text-[11px] font-sans-semibold text-amber-700">Approximate position</Text> : null}
      </View>
    </View>
  )
}
