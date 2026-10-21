import { createElement, useEffect, useRef } from 'react'
import { View } from 'react-native'
import type { StreamLike } from '../types'

/** A picture from a stream in the browser preview: a <video> fed from the stream. */
export function StreamView({ stream, muted, mirrored = false, overlay = false }: { stream: StreamLike | null; muted: boolean; mirrored?: boolean; overlay?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== (stream as unknown as MediaStream | null)) el.srcObject = stream as unknown as MediaStream | null
    if (stream) el.play().catch(() => {})
  }, [stream, muted])

  return (
    <View style={{ flex: 1 }}>
      {createElement('video', {
        ref,
        autoPlay: true,
        playsInline: true,
        muted,
        style: { width: '100%', height: '100%', objectFit: overlay ? 'cover' : 'contain', background: '#000', transform: mirrored ? 'scaleX(-1)' : undefined },
      })}
    </View>
  )
}
