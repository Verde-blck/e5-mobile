import { Text as RNText, type TextProps } from 'react-native'
import { cn } from '@/shared/lib/cn'

// React Native doesn't inherit fonts the way a browser does, so a bare <Text>
// renders in the system font. This wrapper applies the app's defaults unless
// the caller picked its own: font-sans for the family, slate-900 for colour.
// (Both checks matter — if the default colour were always added, a caller's
// `text-white` would lose to it, since utility order decides, not class order.)
const HAS_FONT = /(^|\s)font-(sans|display|mono)/
const HAS_COLOR =
  /(^|\s)text-(white|black|slate|gray|zinc|brand|red|amber|emerald|green|teal|sky|blue|orange|yellow|transparent)/

export function Text({ className, ...props }: TextProps & { className?: string }) {
  const given = className ?? ''
  return (
    <RNText
      className={cn(!HAS_FONT.test(given) && 'font-sans', !HAS_COLOR.test(given) && 'text-slate-900', given)}
      {...props}
    />
  )
}
