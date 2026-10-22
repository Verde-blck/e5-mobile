/*
 * A company's own colours, applied safely.
 *
 * The app's look is five colours (see tailwind.config.js). A company can set a primary colour, and the other four are worked out
 * from it. Two safeguards keep a safety tool usable whatever is saved:
 *  - a primary that white text can't be read on is not applied;
 *  - a primary that looks like the alarm colours (red, orange, amber) is not applied, because alarms must stay the most
 *    noticeable thing on screen. (E5's own orange is deliberately not a UI colour for the same reason.)
 * The second company colour is never a UI colour: it is a small accent on the sign-in and company screens.
 */

export interface BrandColours {
  primary: string
  secondary: string
  tint: string
  soft: string
  mint: string
}

/** The E5 look. Identical to the values in tailwind.config.js, which is where the app got them before they were variables. */
export const DEFAULT_BRAND: BrandColours = { primary: '#0A6659', secondary: '#0C352F', tint: '#E6F2F0', soft: '#B9DAD4', mint: '#A3E2D7' }

/** "#0b5cad", "0b5cad", "#0bc" or "0BC" to "#0B5CAD" / "#00BBCC", as the backend does; null if it isn't a colour. */
export function normaliseColour(input: string): string | null {
  const value = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(value)) return `#${value.split('').map((c) => c + c).join('').toUpperCase()}`
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value.toUpperCase()}`
  return null
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** `amount` of `towards` mixed into `hex` (0 is hex, 1 is towards). */
export function mix(hex: string, towards: string, amount: number): string {
  const a = rgb(hex)
  const b = rgb(towards)
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount])
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast of white text on this colour: 1 (invisible) to 21. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

/** Hue in degrees (0 to 360) and saturation (0 to 1). */
export function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return { hue: 0, saturation: 0 }
  const l = (max + min) / 2
  const saturation = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { hue: (Math.round(h * 60) + 360) % 360, saturation }
}

/** Red, orange and amber: the colours alarms use. */
export function looksLikeAlarm(hex: string): boolean {
  const { hue, saturation } = hueAndSaturation(hex)
  return saturation > 0.4 && (hue <= 50 || hue >= 345)
}

export type PrimaryProblem = 'unreadable' | 'alarm-like'

/** Whether a company's primary colour can be used for the app, and if not, why. */
export function primaryProblem(hex: string | null | undefined): PrimaryProblem | null {
  if (!hex) return null
  if (contrastWithWhite(hex) < 4.5) return 'unreadable'
  if (looksLikeAlarm(hex)) return 'alarm-like'
  return null
}

/** The five colours for a company primary, or the E5 look if there is none or it can't be used. */
export function brandFor(primary: string | null | undefined): BrandColours {
  const hex = primary ? normaliseColour(primary) : null
  if (!hex || hex === DEFAULT_BRAND.primary || primaryProblem(hex)) return DEFAULT_BRAND
  return {
    primary: hex,
    secondary: mix(hex, '#000000', 0.48),
    tint: mix(hex, '#FFFFFF', 0.9),
    soft: mix(hex, '#FFFFFF', 0.7),
    mint: mix(hex, '#FFFFFF', 0.62),
  }
}

/**
 * The colours of the drawn brand surfaces (the sign-in panel and the helmet mark). E5's own are exactly what they have always
 * been; a company's are worked out from its colour, so a blue company doesn't get a green panel under a blue button.
 */
export function surfaceColours(brand: BrandColours): { mint: string; deep: string; panel: string; glow: string } {
  if (brand === DEFAULT_BRAND) return { mint: '#A7E5DA', deep: '#0C352F', panel: '#0B342E', glow: '#0F4F46' }
  return { mint: brand.mint, deep: brand.secondary, panel: brand.secondary, glow: mix(brand.primary, brand.secondary, 0.4) }
}

/** The values the app's styles read, as NativeWind variables. */
export function brandVariables(colours: BrandColours): Record<string, string> {
  return {
    '--brand-primary': colours.primary,
    '--brand-secondary': colours.secondary,
    '--brand-tint': colours.tint,
    '--brand-soft': colours.soft,
    '--brand-mint': colours.mint,
  }
}
