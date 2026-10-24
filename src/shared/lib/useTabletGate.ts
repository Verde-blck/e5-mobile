import { useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'
import { env } from '@/config/env'
import { tabletGate, type TabletGateResult } from './tabletGate'

function read(): TabletGateResult {
  return tabletGate({
    platform: Platform.OS,
    enforce: env.tabletOnly,
    // A test hook (a browser has no phone to test on): set window.__e5TabletOnly = true before the app loads.
    forced: (globalThis as { __e5TabletOnly?: boolean }).__e5TabletOnly === true,
    // The whole screen, not the window: a tablet in split-screen has a narrow window but is still a tablet.
    screen: Dimensions.get('screen'),
  })
}

/** Whether to show the "tablets only" message, kept up to date (a foldable opening, an external display being connected). */
export function useTabletGate(): TabletGateResult {
  const [state, setState] = useState(read)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => setState(read()))
    setState(read())
    return () => subscription.remove()
  }, [])
  return state
}
