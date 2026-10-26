import { createElement, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { plexusHtml } from '@/shared/brand/plexus'

export function PlexusField({ color }: { color: string }) {
  const html = useMemo(() => plexusHtml(color, null), [color])
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {createElement('iframe', {
        srcDoc: html,
        title: 'Animated network',
        'aria-hidden': true,
        tabIndex: -1,
        style: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', border: 0, background: 'transparent', pointerEvents: 'none', colorScheme: 'normal' },
      })}
    </View>
  )
}
