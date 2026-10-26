// Two safeguards for a safety tool: a primary that white text can't be read on is not applied, nor one that
// looks like the alarm colours (red, orange, amber), which must stay the most noticeable thing on screen.

export interface BrandColours {
  primary: string
  secondary: string
  tint: string
  soft: string
  mint: string
}

export const DEFAULT_BRAND: BrandColours = { primary: '#0A6659', secondary: '#0C352F', tint: '#E6F2F0', soft: '#B9DAD4', mint: '#A3E2D7' }

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

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

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

export function looksLikeAlarm(hex: string): boolean {
  const { hue, saturation } = hueAndSaturation(hex)
  return saturation > 0.4 && (hue <= 50 || hue >= 345)
}

export type PrimaryProblem = 'unreadable' | 'alarm-like'

export function primaryProblem(hex: string | null | undefined): PrimaryProblem | null {
  if (!hex) return null
  if (contrastWithWhite(hex) < 4.5) return 'unreadable'
  if (looksLikeAlarm(hex)) return 'alarm-like'
  return null
}

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

export function surfaceColours(brand: BrandColours): { mint: string; deep: string; panel: string; glow: string } {
  if (brand === DEFAULT_BRAND) return { mint: '#A7E5DA', deep: '#0C352F', panel: '#0B342E', glow: '#0F4F46' }
  return { mint: brand.mint, deep: brand.secondary, panel: brand.secondary, glow: mix(brand.primary, brand.secondary, 0.4) }
}

export function brandVariables(colours: BrandColours): Record<string, string> {
  return {
    '--brand-primary': colours.primary,
    '--brand-secondary': colours.secondary,
    '--brand-tint': colours.tint,
    '--brand-soft': colours.soft,
    '--brand-mint': colours.mint,
  }
}
