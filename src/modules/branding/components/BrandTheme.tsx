import type { ReactNode } from 'react'
import { View } from 'react-native'
import { vars } from 'nativewind'
import { brandVariables } from '../lib/colour'
import { useBrandColours } from '../hooks/useBranding'

export function BrandTheme({ children }: { children: ReactNode }) {
  const colours = useBrandColours()
  return <View style={[{ flex: 1 }, vars(brandVariables(colours))]}>{children}</View>
}
