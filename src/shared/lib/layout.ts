import { Dimensions, useWindowDimensions } from 'react-native'

// Width classes follow Material's window size classes. The width is the window's, not
// the device's, so rotating a tablet or using split-screen changes the layout.
export const MEDIUM_MIN_DP = 600
export const TWO_PANE_MIN_DP = 840

export const CONTENT_MAX_DP = 720

export type SizeClass = 'compact' | 'medium' | 'expanded'

export function navigationPosition(sizeClass: SizeClass): 'left' | 'bottom' {
  return sizeClass === 'compact' ? 'bottom' : 'left'
}

export function sizeClassOf(width: number): SizeClass {
  if (width >= TWO_PANE_MIN_DP) return 'expanded'
  if (width >= MEDIUM_MIN_DP) return 'medium'
  return 'compact'
}

export function useLayout() {
  const { width, height } = useWindowDimensions()
  const size = sizeClassOf(width)
  return { width, height, size, twoPane: size === 'expanded', wide: size !== 'compact' }
}

export function listPaneWidth(width: number): number {
  return Math.round(Math.min(420, Math.max(320, width * 0.36)))
}

// For code that runs outside a component (the warning banner), where a hook can't.
export function isTwoPaneNow(): boolean {
  return Dimensions.get('window').width >= TWO_PANE_MIN_DP
}

// The pane only exists on a wide screen, and only if the account is allowed that tab:
// otherwise a restricted account tapping a warning would be sent to a tab it can't use.
export function detailGoesInPane(twoPane: boolean, tabAvailable: boolean): boolean {
  return twoPane && tabAvailable
}

// A rail item is a 58 dp box with a 12 dp gap after it, so each takes 70 dp down the rail
// by default. The box can't be squeezed below what holds an icon and its label.
const RAIL_GAP_DP = 12
const RAIL_ITEM_DP = 58 + RAIL_GAP_DP
const RAIL_ITEM_MIN_DP = 40
const RAIL_PADDING_DP = 28

export function railItemHeight(height: number, items: number): number | undefined {
  if (items <= 0 || items * RAIL_ITEM_DP + RAIL_PADDING_DP <= height) return undefined
  return Math.max(RAIL_ITEM_MIN_DP, Math.floor((height - RAIL_PADDING_DP) / items) - RAIL_GAP_DP)
}

const TILE_GAP = 12
const TILE_MIN = 130

// Four across when they have room, otherwise an even two by two: never three and an
// orphan, which is what a flowing row gives beside a side rail on a tablet in portrait.
export function tileWidthFor(rowWidth: number): number | undefined {
  if (!rowWidth) return undefined
  const columns = rowWidth >= 4 * TILE_MIN + 3 * TILE_GAP ? 4 : 2
  return Math.floor((rowWidth - TILE_GAP * (columns - 1)) / columns)
}
