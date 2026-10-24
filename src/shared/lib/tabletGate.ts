/*
 * Keeping phones out. The app is for tablets, but an APK shared by link installs on any phone, and Android has no way to refuse that,
 * so the app checks the screen when it opens and, on a phone, shows only a message.
 *
 * "A tablet" is measured the way Android measures it: the smallest side of the screen in dp (density-independent pixels).
 * A typical phone is about 320 to 430 dp, a 7 inch tablet is 600, and a 10 inch tablet is 720. So 600 keeps every 8 inch tablet and
 * blocks every phone. It can't tell 7 inches from 8, because dp is not inches.
 */

export const TABLET_MIN_DP = 600

export interface ScreenSize {
  width: number
  height: number
}

/** The smaller of the screen's two sides, in dp: the same whichever way the tablet is held. 0 if it can't be measured. */
export function smallestSideDp(screen: ScreenSize): number {
  const w = Math.round(screen.width)
  const h = Math.round(screen.height)
  return w > 0 && h > 0 ? Math.min(w, h) : 0
}

export interface TabletGateInput {
  /** Android is where the gate applies: the product is an Android APK, and the browser preview is a development tool. */
  platform: string
  /** The EXPO_PUBLIC_TABLET_ONLY setting. */
  enforce: boolean
  /** Forces the gate on whatever the platform, so it can be tested in a browser. */
  forced?: boolean
  screen: ScreenSize
}

export interface TabletGateResult {
  blocked: boolean
  smallestDp: number
}

/**
 * Whether this screen is to be shown the "tablets only" message. A screen that can't be measured is let through: the gate must
 * never lock a real tablet out on a guess.
 */
export function tabletGate({ platform, enforce, forced, screen }: TabletGateInput): TabletGateResult {
  const smallestDp = smallestSideDp(screen)
  const applies = forced === true || (enforce && platform === 'android')
  return { blocked: applies && smallestDp > 0 && smallestDp < TABLET_MIN_DP, smallestDp }
}
