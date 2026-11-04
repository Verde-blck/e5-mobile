import { createElement, useEffect, useRef } from 'react'
import { View } from 'react-native'
import type { StreamLike } from '../types'

// `onAutoplayBlocked`: the browser refused to play with sound until the person interacts.
export function StreamView({ stream, muted, mirrored = false, overlay = false, onAutoplayBlocked }: { stream: StreamLike | null; muted: boolean; mirrored?: boolean; overlay?: boolean; onAutoplayBlocked?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== (stream as unknown as MediaStream | null)) el.srcObject = stream as unknown as MediaStream | null
    // Set directly: React applies the muted prop to <video> unreliably, which can leave sound off.
    el.muted = muted
    if (!stream) return
    el.play().catch((error: DOMException) => {
      if (error?.name === 'NotAllowedError') onAutoplayBlocked?.()
    })
  }, [stream, muted, onAutoplayBlocked])

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
