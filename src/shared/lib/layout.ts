import { Dimensions, useWindowDimensions } from 'react-native'

/**
 * Screen-width classes, in dp (density-independent pixels), following Material's
 * window size classes. The width is the *window's*, not the device's, so
 * turning a tablet or putting the app in split-screen changes the layout.
 *
 *  - compact  < 600   phones                                 one pane, bottom tabs
 *  - medium   600-839 8-10" tablets in portrait              one pane, bottom tabs, capped width
 *  - expanded >= 840  8-10" tablets in landscape             side rail, list and detail together
 */
export const MEDIUM_MIN_DP = 600
export const TWO_PANE_MIN_DP = 840

/** Reading width for single-column content, so a portrait tablet isn't a wall of stretched cards. */
export const CONTENT_MAX_DP = 720

export type SizeClass = 'compact' | 'medium' | 'expanded'

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

/** Width of the list column when list and detail sit side by side. */
export function listPaneWidth(width: number): number {
  return Math.round(Math.min(420, Math.max(320, width * 0.36)))
}

/** For code that runs outside a component (the banner, a toast), where a hook can't. */
export function isTwoPaneNow(): boolean {
  return Dimensions.get('window').width >= TWO_PANE_MIN_DP
}

/**
 * Whether opening an item should show it in the right-hand pane of its tab (true)
 * or push it as a full screen (false). The pane only exists on a wide screen, and
 * only if the account is allowed that tab: otherwise a restricted account tapping
 * the SOS banner would be sent to a tab it can't use.
 */
export function detailGoesInPane(twoPane: boolean, tabAvailable: boolean): boolean {
  return twoPane && tabAvailable
}
