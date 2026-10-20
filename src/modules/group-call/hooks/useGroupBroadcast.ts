import { useState } from 'react'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { sendBroadcast } from '../api/broadcast.api'
import { allFailed, toOutcomes } from '../lib/outcomes'
import type { Outcome, Target } from '../types'

/**
 * Walkie-talkie: sends one recording to several helmets in a single request. The results stay per helmet.
 * Resolves true when the request went through (even if some helmets didn't take it), so the recording is
 * kept for another go only when nothing was sent at all.
 */
export function useGroupBroadcast() {
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<Outcome[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function broadcast(targets: readonly Target[], audio: RecordedAudio): Promise<boolean> {
    setSending(true)
    setResults(null)
    setProblem(null)
    try {
      const deliveries = await sendBroadcast(targets.map((t) => t.id), audio)
      setResults(toOutcomes(targets, deliveries))
      return true
    } catch (error) {
      setResults(allFailed(targets))
      setProblem(error instanceof Error && error.name === 'BroadcastUnavailable' ? error.message : "The message couldn't be sent. Check the connection and try again.")
      return false
    } finally {
      setSending(false)
    }
  }

  return { broadcast, sending, results, problem, clear: () => { setResults(null); setProblem(null) } }
}
