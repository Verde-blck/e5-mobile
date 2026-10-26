import { useState } from 'react'
import { Image, View } from 'react-native'
import { useBranding } from '@/modules/branding/hooks/useBranding'
import { Text } from './Text'
import { BrandMark } from './BrandMark'

export function Logo({ size = 36 }: { size?: number }) {
  const name = useBranding().companyName ?? 'E5 Energy'
  return (
    <View className="flex-row items-center gap-3">
      <BrandMark size={size} />
      <Text className="font-sans-medium text-base text-white">{name}</Text>
    </View>
  )
}

const COMPANY_LOGO = require('../../../assets/brand/e5-energy-logo.png')
const resolved = typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(COMPANY_LOGO) : undefined
const ASPECT = resolved?.width && resolved.height ? resolved.height / resolved.width : 132 / 236

// The uploaded one is a signed link that expires, so if it can't
// be loaded the E5 logo is shown instead of an empty space.
export function CompanyLogo({ width = 96 }: { width?: number }) {
  const { logoUrl, companyName } = useBranding()
  const [failed, setFailed] = useState<string | null>(null)
  const label = companyName ?? 'E5 Energy'
  if (logoUrl && failed !== logoUrl) {
    return <Image source={{ uri: logoUrl }} accessibilityRole="image" accessibilityLabel={label} resizeMode="contain" onError={() => setFailed(logoUrl)} style={{ width, height: width * 0.6 }} />
  }
  return <Image source={COMPANY_LOGO} accessibilityRole="image" accessibilityLabel={label} resizeMode="contain" style={{ width, height: width * ASPECT }} />
}
