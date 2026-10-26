import { useEffect, useState } from 'react'

// Presence is derived from "how long ago was this helmet last seen", so it
// has to be recomputed as time passes, not only when new data arrives.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
