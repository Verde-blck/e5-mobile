import { useEffect, useMemo, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { plexusHtml } from '@/shared/brand/plexus'

/**
 * The sign-in panel's animated network (see brand/plexus.ts), drawn in a transparent web view that touches pass straight through.
 * If the device asks for reduced motion it draws one still frame. It waits to find that out first, so a person who has asked for
 * no motion never sees any.
 */
export function PlexusField({ color }: { color: string }) {
  const [reduce, setReduce] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v))
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(v))
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  const html = useMemo(() => plexusHtml(color, reduce ?? false), [color, reduce])
  if (reduce === null) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        accessible={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: 'transparent' } })
