import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg'
import { BRAND } from '@/shared/brand/mark'

/**
 * The app's backdrop, from the web's `.app-canvas`: a fine dot grid for texture and two wide washes
 * tinted with the brand (teal from the top-left, deep green from the top-right). Kept deliberately
 * faint: this is a safety app, and an alarm's red and amber must stay the most salient thing on screen.
 */
export function AppCanvas() {
  const { width, height } = useWindowDimensions()
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="ac-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <Circle cx="1" cy="1" r="1" fill="#64748B" fillOpacity="0.055" />
          </Pattern>
          <RadialGradient id="ac-wash-1" gradientUnits="userSpaceOnUse" cx={width * 0.1} cy={-height * 0.08} rx="900" ry="520">
            <Stop offset="0" stopColor="#0A6659" stopOpacity="0.1" />
            <Stop offset="0.62" stopColor="#0A6659" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ac-wash-2" gradientUnits="userSpaceOnUse" cx={width * 0.98} cy={height * 0.02} rx="760" ry="460">
            <Stop offset="0" stopColor="#0C352F" stopOpacity="0.07" />
            <Stop offset="0.58" stopColor="#0C352F" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={BRAND.canvas} />
        <Rect width="100%" height="100%" fill="url(#ac-dots)" />
        <Rect width="100%" height="100%" fill="url(#ac-wash-1)" />
        <Rect width="100%" height="100%" fill="url(#ac-wash-2)" />
      </Svg>
    </View>
  )
}
