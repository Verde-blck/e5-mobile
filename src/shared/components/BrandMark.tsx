import Svg, { Path, Rect } from 'react-native-svg'
import { BRAND, HELMET } from '@/shared/brand/mark'

/** The product mark: a mint tile with a hard hat (or just the hat, with `tile={false}`). */
export function BrandMark({ size = 40, tile = true, color = BRAND.deep }: { size?: number; tile?: boolean; color?: string }) {
  const ridge = tile ? BRAND.mint : 'transparent'
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="E5 Energy">
      {tile ? <Rect width={100} height={100} rx={24} fill={BRAND.mint} /> : null}
      <Path d={HELMET.dome} fill={color} />
      <Rect {...HELMET.brim} fill={color} />
      <Path d={HELMET.ridgeLeft} fill="none" stroke={ridge} strokeWidth={3.2} strokeLinecap="round" />
      <Path d={HELMET.ridgeRight} fill="none" stroke={ridge} strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
  )
}
