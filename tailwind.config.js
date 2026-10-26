module.exports = {
  // Light-only, with no `dark:` styles. 'class' is here because on web, when the dev server
  // delivers the stylesheet after the JavaScript has run, NativeWind calls colorScheme.set()
  // once at startup and the default ('media') throws "Cannot manually set color scheme".
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Their orange is deliberately not a UI colour: red and amber have
        // to stay the most salient things on screen for alarm states.
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          tint: 'var(--brand-tint)',
          soft: 'var(--brand-soft)',
          mint: 'var(--brand-mint)',
        },
      },
      // React Native can't use font stacks or font-weight with custom fonts:
      // each weight is its own family, registered in src/app/_layout.tsx.
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        display: ['Epilogue_600SemiBold'],
        'display-bold': ['Epilogue_700Bold'],
        'display-extrabold': ['Epilogue_800ExtraBold'],
        mono: ['GeistMono_400Regular'],
        'mono-medium': ['GeistMono_500Medium'],
      },
    },
  },
  plugins: [],
}
