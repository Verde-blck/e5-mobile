// An APK shared by link installs on any phone and Android can't refuse that, so
// the app checks the screen when it opens and shows phones only a message.

export const TABLET_MIN_DP = 600

export interface ScreenSize {
  width: number
  height: number
}

export function smallestSideDp(screen: ScreenSize): number {
  const w = Math.round(screen.width)
  const h = Math.round(screen.height)
  return w > 0 && h > 0 ? Math.min(w, h) : 0
}

export interface TabletGateInput {
  platform: string
  enforce: boolean
  forced?: boolean
  screen: ScreenSize
}

export interface TabletGateResult {
  blocked: boolean
  smallestDp: number
}

// A screen that can't be measured is let through: the gate must never lock a real tablet out on a guess.
export function tabletGate({ platform, enforce, forced, screen }: TabletGateInput): TabletGateResult {
  const smallestDp = smallestSideDp(screen)
  const applies = forced === true || (enforce && platform === 'android')
  return { blocked: applies && smallestDp > 0 && smallestDp < TABLET_MIN_DP, smallestDp }
}
