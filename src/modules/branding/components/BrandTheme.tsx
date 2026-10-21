import type { ReactNode } from 'react'
import { View } from 'react-native'
import { vars } from 'nativewind'
import { brandVariables } from '../lib/colour'
import { useBrandColours } from '../hooks/useBranding'

/**
 * Applies the company's colours to everything inside it, by setting the five brand variables that the app's styles read. With no
 * company colour (or one that can't be used safely) these are exactly the E5 colours, so the app looks as it always has.
 */
export function BrandTheme({ children }: { children: ReactNode }) {
  const colours = useBrandColours()
  return <View style={[{ flex: 1 }, vars(brandVariables(colours))]}>{children}</View>
}
