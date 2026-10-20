import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, Line, Path, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'
import { BRAND } from '@/shared/brand/mark'

// A decorative field of telemetry: a fine grid, flowing readings, a dashed geofence, a thick route and
// a scatter of helmets joined into a constellation. Drawn in a 569 x 700 box and scaled to fill whatever
// it is placed in (cropped rather than squashed), so it works as a banner or a full-height panel.
// [x, y, radius, opacity, glow]
const NODES: Array<[number, number, number, number, boolean?]> = [
  [60, 26, 2, 0.5], [97, 90, 3.2, 0.9], [218, 53, 1.8, 0.5], [254, 141, 3, 0.9], [268, 227, 3.2, 0.9],
  [272, 133, 1.8, 0.6], [300, 123, 1.6, 0.6], [375, 20, 1.6, 0.5], [392, 194, 4.6, 1, true], [421, 78, 2.2, 0.6],
  [461, 157, 2.4, 0.7], [549, 201, 2.5, 0.6], [229, 236, 2, 0.5], [126, 285, 2.6, 0.8], [311, 318, 2.2, 0.6],
  [139, 383, 2.6, 0.8], [213, 411, 2.2, 0.6], [481, 338, 2.4, 0.7], [508, 411, 4.6, 1, true], [455, 486, 2, 0.5],
  [515, 509, 3.4, 0.9], [484, 527, 2, 0.4], [335, 493, 2, 0.5], [232, 513, 2, 0.5], [75, 402, 2, 0.5],
  [26, 157, 2, 0.5], [6, 217, 2, 0.4], [26, 351, 2, 0.5], [531, 602, 3, 0.6], [280, 430, 1.6, 0.4],
]
const EDGES: Array<[number, number]> = [[1, 3], [3, 4], [4, 5], [5, 6], [8, 10], [10, 11], [13, 15], [15, 16], [17, 18], [18, 20], [20, 19], [14, 22], [22, 23], [9, 10], [3, 12]]

const WAVES = [
  'M-20 120 C 120 70, 230 190, 360 140 S 520 80, 600 130',
  'M-20 255 C 110 200, 220 330, 350 270 S 500 230, 600 300',
  'M-20 330 C 120 385, 250 275, 380 345 S 520 425, 600 385',
  'M-20 505 C 140 460, 260 565, 390 505 S 520 470, 600 525',
]
const ROUTE = 'M-30 690 C 120 610, 300 505, 385 335 S 485 190, 610 140'

export function BrandConstellation() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 569 700" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="bc-glow" cx="50%" cy="46%" rx="75%" ry="70%">
            <Stop offset="0" stopColor="#0F4F46" stopOpacity="0.9" />
            <Stop offset="1" stopColor={BRAND.panel} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bc-node" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <Pattern id="bc-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <Path d="M44 0H0V44" fill="none" stroke={BRAND.mint} strokeOpacity="0.05" strokeWidth="1" />
          </Pattern>
        </Defs>

        <Rect width="569" height="700" fill={BRAND.panel} />
        <Rect width="569" height="700" fill="url(#bc-glow)" />
        <Rect width="569" height="700" fill="url(#bc-grid)" />

        {/* readings */}
        {WAVES.map((d) => (
          <Path key={d} d={d} fill="none" stroke={BRAND.mint} strokeOpacity="0.16" strokeWidth="1.4" />
        ))}
        {/* a route */}
        <Path d={ROUTE} fill="none" stroke={BRAND.mint} strokeOpacity="0.16" strokeWidth="30" strokeLinecap="round" />
        <Path d={ROUTE} fill="none" stroke={BRAND.mint} strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
        {/* a geofence */}
        <Polygon points="100,93 441,60 500,390 408,548 140,525" fill={BRAND.mint} fillOpacity="0.03" stroke={BRAND.mint} strokeOpacity="0.32" strokeWidth="1.4" strokeDasharray="7 6" />

        {/* the constellation */}
        {EDGES.map(([a, b]) => (
          <Line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke={BRAND.mint} strokeOpacity="0.2" strokeWidth="1" />
        ))}
        {NODES.map(([x, y, r, o, glow], i) => (
          <Circle key={i} cx={x} cy={y} r={glow ? r * 5 : 0} fill={glow ? 'url(#bc-node)' : 'none'} />
        ))}
        {NODES.map(([x, y, r, o], i) => (
          <Circle key={`n${i}`} cx={x} cy={y} r={r} fill="#FFFFFF" fillOpacity={o} />
        ))}
      </Svg>
    </View>
  )
}
