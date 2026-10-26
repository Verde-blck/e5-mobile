import { useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'
import { env } from '@/config/env'
import { tabletGate, type TabletGateResult } from './tabletGate'

function read(): TabletGateResult {
  return tabletGate({
    platform: Platform.OS,
    enforce: env.tabletOnly,
    forced: env.useMocks && (globalThis as { __e5TabletOnly?: boolean }).__e5TabletOnly === true,
    screen: Dimensions.get('screen'),
  })
}

export function useTabletGate(): TabletGateResult {
  const [state, setState] = useState(read)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => setState(read()))
    setState(read())
    return () => subscription.remove()
  }, [])
  return state
}
