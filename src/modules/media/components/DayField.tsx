import { useEffect, useState } from 'react'
import { TextField } from '@/shared/components/TextField'
import { parseDay } from '@/modules/track/lib/range'

/**
 * One day, typed as year-month-day. It only changes the filter once it is a real date (so half-typed text doesn't
 * trigger a search), says so when it isn't, and follows the calendar when a day is picked there.
 */
export function DayField({ value, onChange, label = 'Date' }: { value?: string; onChange: (day: string | undefined) => void; label?: string }) {
  const [text, setText] = useState(value ?? '')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(value ?? '')
    setError(null)
  }, [value])

  function change(next: string) {
    setText(next)
    if (next.trim() === '') {
      setError(null)
      onChange(undefined)
    } else if (parseDay(next)) {
      setError(null)
      onChange(next.trim())
    } else {
      setError(next.length >= 10 ? 'That is not a real date. Use year-month-day, like 2026-10-20.' : null)
    }
  }

  return <TextField label={label} value={text} onChangeText={change} placeholder="2026-10-20" error={error} maxLength={10} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" mono />
}
