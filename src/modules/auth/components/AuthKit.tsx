import { useState } from 'react'
import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { Text } from '@/shared/components/Text'

/*
 * The pieces of the sign-in screen, drawn to match the web dashboard's sign-in page (AuthLayout.tsx) so the two look like one product.
 * They are used only by the sign-in screen: the rest of the app keeps its own fields and buttons (shared/components).
 *
 * Measurements are the web page's, read from it in a browser: a field is 44.5 tall with 8 px corners and a 1 px border, a label is
 * 13 px medium, the button is 46.5 tall, and so on. Colours are the web's too.
 */

export const INK = '#1A2B28'
export const PAGE = '#F2F8F7'
/** The ink at a given strength, as the web page writes it (text-[#1A2B28]/70). */
export const ink = (alpha: number) => `rgba(26, 43, 40, ${alpha})`

/** "#0C352F" and 0.18 as "rgba(12, 53, 47, 0.18)". */
export function rgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`
}

/** The product mark: a mint tile with a hard hat drawn as a line, as at the top of the web page's panel. */
export function AuthHelmetMark({ colour }: { colour: string }) {
  const mint = useBrandColours().mint
  return (
    <View accessibilityRole="image" accessibilityLabel="E5 Energy" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: mint, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4.5 16a7.5 7.5 0 0 1 15 0" />
        <Path d="M12 8.5V16" />
        <Path d="M2.5 16h19" />
        <Path d="M3.5 16v1.5h17V16" />
      </Svg>
    </View>
  )
}

function Glyph({ children, colour }: { children: React.ReactNode; colour: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  )
}

interface AuthFieldProps extends Omit<TextInputProps, 'className' | 'style'> {
  label: string
  error?: string | null
  /** A small picture at the left of the field, as on the web page. */
  icon?: 'user' | 'lock'
  /** A password: hidden, with an eye button to show it. */
  secret?: boolean
  /** The six-digit code: large, centred, spaced out. */
  code?: boolean
}

export function AuthField({ label, error, icon, secret, code, ...input }: AuthFieldProps) {
  const brand = useBrandColours()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const leading = icon && !code ? 40 : 12

  return (
    <View style={{ marginBottom: 16 }}>
      <Text className="font-sans-medium" style={{ fontSize: 13, lineHeight: 19.5, color: INK, marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          height: code ? 56 : 44.5,
          borderRadius: 8,
          borderWidth: 1,
          backgroundColor: '#FFFFFF',
          borderColor: error ? '#DC2626' : focused ? brand.primary : ink(0.15),
          // The web page's focus ring: three pixels of mint round the field.
          boxShadow: focused ? '0 0 0 3px #A3E2D7' : undefined,
          justifyContent: 'center',
        }}
      >
        {icon && !code ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 12 }}>
            <Glyph colour={ink(0.4)}>
              {icon === 'user' ? (
                <>
                  <Circle cx={12} cy={8} r={3.5} />
                  <Path d="M5 20a7 7 0 0 1 14 0" />
                </>
              ) : (
                <>
                  <Rect x={5} y={10.5} width={14} height={10} rx={2} />
                  <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
                </>
              )}
            </Glyph>
          </View>
        ) : null}
        <TextInput
          {...input}
          secureTextEntry={secret && !revealed}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          placeholderTextColor={ink(0.4)}
          cursorColor={brand.primary}
          selectionColor={`${brand.primary}40`}
          accessibilityLabel={label}
          className={code ? 'font-mono' : 'font-sans'}
          // minWidth 0: a browser input won't shrink below its intrinsic width, which the spaced code digits exceed.
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            color: INK,
            fontSize: code ? 24 : 15,
            textAlign: code ? 'center' : 'left',
            letterSpacing: code ? 10 : 0,
            paddingLeft: leading,
            paddingRight: secret ? 44 : 12,
          }}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: revealed }}
            onPress={() => setRevealed((v) => !v)}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Glyph colour={revealed ? brand.primary : ink(0.5)}>
              <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <Circle cx={12} cy={12} r={2.75} />
              {revealed ? <Path d="M4 4l16 16" /> : null}
            </Glyph>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 18, color: '#B91C1C', marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** The brand colour at `amount` of its brightness: the web page darkens its button to 92% when you press or hover it. */
function shade(hex: string, amount: number): string {
  const v = hex.replace('#', '')
  const channel = (i: number) => Math.round(parseInt(v.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

/**
 * The sign-in button, as the web page's: 46.5 tall, 8 px corners, the brand colour with a soft glow beneath it, a touch darker and
 * one pixel lower while pressed, a spinner and a dimmer look while it works. Like the web's, it is not greyed out when the form is
 * empty: pressing it says what is missing.
 */
export function AuthButton({ title, busyTitle, busy, disabled, onPress }: { title: string; busyTitle?: string; busy?: boolean; disabled?: boolean; onPress: () => void }) {
  const brand = useBrandColours()
  const inactive = !!busy || !!disabled
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 46.5,
        borderRadius: 8,
        backgroundColor: pressed ? shade(brand.primary, 0.92) : brand.primary,
        opacity: busy ? 0.8 : disabled ? 0.5 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }],
        boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 6px 16px -8px ${rgba(brand.primary, 0.7)}`,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
      })}
    >
      {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
      <Text className="font-sans-semibold" style={{ fontSize: 15, color: '#FFFFFF' }}>
        {busy ? (busyTitle ?? title) : title}
      </Text>
    </Pressable>
  )
}

/** A text link under the form, in the brand colour: the web page's `authLink`. */
export function AuthLink({ title, onPress }: { title: string; onPress: () => void }) {
  const brand = useBrandColours()
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title} hitSlop={8} onPress={onPress} style={{ alignSelf: 'center', paddingVertical: 10 }}>
      <Text className="font-sans-medium" style={{ fontSize: 14, color: brand.primary }}>
        {title}
      </Text>
    </Pressable>
  )
}
