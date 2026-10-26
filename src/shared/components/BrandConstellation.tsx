import { StyleSheet, View } from 'react-native'
import Svg, { Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { PlexusField } from '@/shared/components/PlexusField'

const CONTOURS = [
  'M-20 140C60 110 110 180 190 160S320 70 420 110',
  'M-20 190C70 160 120 235 200 212S330 120 420 160',
  'M-20 250C80 222 130 290 210 268S340 180 420 220',
  'M-20 420C60 380 150 450 240 410S350 350 420 380',
  'M-20 470C70 432 160 500 250 462S360 400 420 430',
]

export function BrandConstellation() {
  const brand = useBrandColours()
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <Pattern id="plan-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Path d="M24 0H0v24" fill="none" stroke={brand.mint} strokeOpacity="0.07" />
          </Pattern>
        </Defs>
        <Rect width="400" height="600" fill="url(#plan-grid)" />

        <G fill="none" stroke={brand.mint} strokeOpacity="0.16" strokeWidth="1">
          {CONTOURS.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>

        <Path d="M70 120L310 96L352 330L268 470L96 436Z" fill={brand.primary} fillOpacity="0.18" stroke={brand.mint} strokeOpacity="0.35" strokeDasharray="4 6" />
        <Path d="M-10 520C90 470 170 380 230 300S330 180 410 150" fill="none" stroke={brand.mint} strokeOpacity="0.22" strokeWidth="10" strokeLinecap="round" />
      </Svg>

      <PlexusField color={brand.mint} />

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '66.6667%' }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="plan-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={brand.secondary} stopOpacity="0" />
              <Stop offset="0.5" stopColor={brand.secondary} stopOpacity="0.7" />
              <Stop offset="1" stopColor={brand.secondary} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#plan-fade)" />
        </Svg>
      </View>
    </View>
  )
}
