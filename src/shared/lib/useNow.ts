import { useEffect, useState } from 'react'

/**
 * The current time, refreshed on an interval.
 *
 * Presence is derived from "how long ago was this helmet last seen", so it has
 * to be recomputed as time passes — not only when new data arrives. A helmet
 * that goes quiet produces *no* new data, which is exactly when its status
 * needs to change.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
