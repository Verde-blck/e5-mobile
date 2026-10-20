/** @type {import('tailwindcss').Config} */
module.exports = {
  // The app is light-only (app.json forces it) and uses no `dark:` styles. This setting is
  // here for one reason: on web, when the dev server delivers the stylesheet after the
  // JavaScript has run, NativeWind calls colorScheme.set() once at startup, and with the
  // default ('media') that throws "Cannot manually set color scheme". 'class' allows the call.
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // E5 Energy: the teal from their logo and the deep green of their
        // website hero — the same two values as globals.css on the web app.
        // Their orange is deliberately not a UI colour: red and amber have to
        // stay the most salient things on screen for alarm states.
        brand: {
          primary: '#0A6659',
          secondary: '#0C352F',
          tint: '#E6F2F0',
          soft: '#B9DAD4',
          mint: '#A3E2D7', // the light teal on dark panels (live status, call controls)
        },
      },
      /*
       * React Native can't use font stacks or font-weight with custom fonts:
       * each weight is its own family, registered in src/app/_layout.tsx. So
       * `font-bold` does nothing here — use font-sans-bold, font-display-bold
       * and so on. The names on the right must match the keys given to useFonts.
       */
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
