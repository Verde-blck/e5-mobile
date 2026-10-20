import { Image, View } from 'react-native'
import { Text } from './Text'
import { BrandMark } from './BrandMark'

/** The product lockup for dark surfaces: the mark and "E5 Energy", as at the top of the web's sign-in panel. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <View className="flex-row items-center gap-3">
      <BrandMark size={size} />
      <Text className="font-sans-medium text-base text-white">E5 Energy</Text>
    </View>
  )
}

// To use the real artwork, replace this file with the original (a transparent PNG at 3x or better, or
// anything with about the same proportions): the component reads the file's own size.
const COMPANY_LOGO = require('../../../assets/brand/e5-energy-logo.png')
const resolved = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(COMPANY_LOGO) : undefined
const ASPECT = resolved?.width && resolved.height ? resolved.height / resolved.width : 224 / 384

/** The E5 ENERGY company logo, for light surfaces. */
export function CompanyLogo({ width = 96 }: { width?: number }) {
  return (
    <Image
      source={COMPANY_LOGO}
      accessibilityRole="image"
      accessibilityLabel="E5 Energy"
      resizeMode="contain"
      style={{ width, height: width * ASPECT }}
    />
  )
}
