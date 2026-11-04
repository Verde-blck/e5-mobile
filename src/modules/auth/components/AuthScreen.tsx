import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBrandColours, useBranding } from '@/modules/branding/hooks/useBranding'
import { BrandConstellation } from '@/shared/components/BrandConstellation'
import { CompanyLogo } from '@/shared/components/Logo'
import { Text } from '@/shared/components/Text'
import { openPrivacyPolicy } from '@/shared/lib/privacyPolicy'
import { AuthHelmetMark, AuthLink, INK, PAGE, ink, rgba } from './AuthKit'

/*
 * The layout of the signed-out screens, as the web dashboard's sign-in page (AuthLayout.tsx), so the two look like one product. Every
 * measurement is that page's, read from it in a browser.
 *
 *   Under 640 wide    a 224 tall banner with the card overlapping its lower edge by 40, the card as wide as the screen allows.
 *   640 and up        the same, with a 256 tall banner, larger type, and a 400 wide card.
 *   1024 and up       two panes: the panel on the left (5 parts of 12), the card centred in the rest (7 parts).
 *
 * These are the web page's own widths, not the app's tablet breakpoints, which are for the lists and detail screens. Sign-in uses it,
 * and so does the screen that makes someone choose their own password.
 */
export function AuthScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const branding = useBranding()
  const brand = useBrandColours()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const sm = width >= 640
  const split = width >= 1024

  const hero = (
    <View
      testID="signin-hero"
      style={[
        { backgroundColor: brand.secondary, overflow: 'hidden' },
        // A banner is tall enough for its content plus the status bar above it; the panel fills its half.
        split ? { flex: 5 } : { height: (sm ? 256 : 224) + insets.top },
      ]}
    >
      <BrandConstellation />
      <View
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingHorizontal: split ? 48 : sm ? 32 : 24,
          paddingTop: insets.top + (split ? 40 : 20),
          paddingBottom: split ? 40 : sm ? 80 : 72,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AuthHelmetMark colour={brand.secondary} />
          <Text className="font-sans-medium" style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255, 255, 255, 0.9)' }}>
            {branding.companyName ?? 'E5 Energy'}
          </Text>
        </View>

        <View style={{ maxWidth: 448 }}>
          {(() => {
            const size = split ? 52 : sm ? 40 : 32
            return (
              <Text testID="signin-title" className="font-display" style={{ fontSize: size, lineHeight: size * 1.05, letterSpacing: -0.02 * size, color: '#FFFFFF' }}>
                Command Centre
              </Text>
            )
          })()}
          {sm ? (
            <Text style={{ marginTop: 12, maxWidth: 384, fontSize: 15, lineHeight: 24.375, color: brand.mint }}>
              Live location, alarms and gas readings for every helmet in the fleet.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )

  const cardBox = (
    <View
      testID="signin-card"
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ink(0.06),
        backgroundColor: '#FFFFFF',
        padding: sm ? 32 : 24,
        boxShadow: `0 1px 2px ${rgba(brand.secondary, 0.06)}, 0 12px 32px -12px ${rgba(brand.secondary, 0.18)}`,
      }}
    >
      <View style={{ marginBottom: 24 }}>
        <CompanyLogo width={sm ? 86 : 79} />
        {branding.secondaryColor ? <View accessibilityLabel="Company accent" style={{ marginTop: 8, height: 3, width: 44, borderRadius: 2, backgroundColor: branding.secondaryColor }} /> : null}
      </View>
      {children}
    </View>
  )

  const column = (
    <View style={{ alignSelf: 'center', width: '100%', maxWidth: 400 }}>
      {cardBox}
      {footer}
      <View style={{ marginTop: 4 }}>
        <AuthLink title="Privacy policy" onPress={openPrivacyPolicy} />
      </View>
    </View>
  )

  if (split) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: PAGE }}>
        <StatusBar style="light" />
        {hero}
        <KeyboardAvoidingView style={{ flex: 7 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}>
            {column}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
          {hero}
          {/* The card overlaps the banner by 40. */}
          <View style={{ marginTop: -40, paddingHorizontal: sm ? 24 : 16, paddingBottom: 48 }}>{column}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

export function AuthHeading({ children }: { children: ReactNode }) {
  return (
    <Text testID="signin-heading" accessibilityRole="header" className="font-display" style={{ fontSize: 26, lineHeight: 32.5, letterSpacing: -0.26, color: INK }}>
      {children}
    </Text>
  )
}

export function AuthSubheading({ children }: { children: ReactNode }) {
  // 28 below it, to the first field: the web page's mt-7.
  return <Text style={{ marginTop: 6, marginBottom: 28, fontSize: 14, lineHeight: 22.75, color: ink(0.7) }}>{children}</Text>
}

/** The line under a screen's fields: what the card is for, or a way out. */
export function AuthFooterText({ children }: { children: ReactNode }) {
  return <Text style={{ marginTop: 20, paddingHorizontal: 4, textAlign: 'center', fontSize: 13, lineHeight: 21.125, color: ink(0.7) }}>{children}</Text>
}
