import { StyleSheet, View } from 'react-native'
import Svg, { Defs, Path, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { PlexusField } from '@/shared/components/PlexusField'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { surfaceColours } from '@/modules/branding/lib/colour'

// The sign-in panel: a fine grid, flowing readings, a dashed geofence and a thick route, drawn in a 569 x 700 box and scaled to
// fill whatever it is placed in (cropped rather than squashed), so it works as a banner or a full-height panel. Over it, the
// animated network of helmets (PlexusField), as on the web dashboard.

const WAVES = [
  'M-20 120 C 120 70, 230 190, 360 140 S 520 80, 600 130',
  'M-20 255 C 110 200, 220 330, 350 270 S 500 230, 600 300',
  'M-20 330 C 120 385, 250 275, 380 345 S 520 425, 600 385',
  'M-20 505 C 140 460, 260 565, 390 505 S 520 470, 600 525',
]
const ROUTE = 'M-30 690 C 120 610, 300 505, 385 335 S 485 190, 610 140'

export function BrandConstellation() {
  const brand = useBrandColours()
  const surface = surfaceColours(brand)
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 569 700" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="bc-glow" cx="50%" cy="46%" rx="75%" ry="70%">
            <Stop offset="0" stopColor={surface.glow} stopOpacity="0.9" />
            <Stop offset="1" stopColor={surface.panel} stopOpacity="0" />
          </RadialGradient>
          <Pattern id="bc-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <Path d="M44 0H0V44" fill="none" stroke={surface.mint} strokeOpacity="0.05" strokeWidth="1" />
          </Pattern>
        </Defs>

        <Rect width="569" height="700" fill={surface.panel} />
        <Rect width="569" height="700" fill="url(#bc-glow)" />
        <Rect width="569" height="700" fill="url(#bc-grid)" />

        {/* readings */}
        {WAVES.map((d) => (
          <Path key={d} d={d} fill="none" stroke={surface.mint} strokeOpacity="0.16" strokeWidth="1.4" />
        ))}
        {/* a route */}
        <Path d={ROUTE} fill="none" stroke={surface.mint} strokeOpacity="0.16" strokeWidth="30" strokeLinecap="round" />
        <Path d={ROUTE} fill="none" stroke={surface.mint} strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
        {/* a geofence */}
        <Polygon points="100,93 441,60 500,390 408,548 140,525" fill={surface.mint} fillOpacity="0.03" stroke={surface.mint} strokeOpacity="0.32" strokeWidth="1.4" strokeDasharray="7 6" />
      </Svg>
      <PlexusField color={brand.mint} />
    </View>
  )
}
