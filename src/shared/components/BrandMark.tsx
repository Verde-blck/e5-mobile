import Svg, { Path, Rect } from 'react-native-svg'
import { HELMET } from '@/shared/brand/mark'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { surfaceColours } from '@/modules/branding/lib/colour'

/** The product mark: a mint tile with a hard hat (or just the hat, with `tile={false}`). */
export function BrandMark({ size = 40, tile = true, color }: { size?: number; tile?: boolean; color?: string }) {
  const surface = surfaceColours(useBrandColours())
  const ink = color ?? surface.deep
  const ridge = tile ? surface.mint : 'transparent'
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="E5 Energy">
      {tile ? <Rect width={100} height={100} rx={24} fill={surface.mint} /> : null}
      <Path d={HELMET.dome} fill={ink} />
      <Rect {...HELMET.brim} fill={ink} />
      <Path d={HELMET.ridgeLeft} fill="none" stroke={ridge} strokeWidth={3.2} strokeLinecap="round" />
      <Path d={HELMET.ridgeRight} fill="none" stroke={ridge} strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
  )
}
