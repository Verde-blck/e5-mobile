import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { defaultDeps } from '../lib/defaultDeps'
import { HelmetSession } from '../lib/session'
import { WallSessions } from '../lib/wall'

/**
 * The wall's sessions for the screen that uses it. Leaving the screen (another tab) disconnects every helmet; coming
 * back reconnects the same ones. Reconnecting is started from a timer that an undo cancels, never straight from an
 * effect, so React running an effect twice in development can't send a helmet start, stop, start.
 */
export function useWallSessions(): WallSessions {
  const [wall] = useState(
    () =>
      new WallSessions(
        (id) => new HelmetSession(id, 'watch', defaultDeps),
        (callback) => {
          const subscription = AppState.addEventListener('change', (state) => callback(state !== 'active'))
          return () => subscription.remove()
        }
      )
  )
  useSyncExternalStore(wall.subscribe, wall.getVersion)

  useEffect(() => {
    wall.attach()
    return () => wall.dispose()
  }, [wall])

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => wall.resume(), 0)
      return () => {
        clearTimeout(timer)
        wall.suspend()
      }
    }, [wall])
  )
  return wall
}
