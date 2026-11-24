/**
 * The soft shadow under the main button. Apple devices get the classic shadow settings. The combined inner-and-outer shadow written as one
 * boxShadow string, which the other platforms use, left the button's background undrawn on an iPhone (white text on a white card), and it
 * was the only inner shadow in the app.
 */
export function buttonShadow(os: string, colour: { solid: string; soft: string }) {
  if (os === 'ios') return { shadowColor: colour.solid, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }
  return { boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 6px 16px -8px ${colour.soft}` }
}
