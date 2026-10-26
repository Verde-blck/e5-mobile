
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const pad = (n: number) => String(n).padStart(2, '0')

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + by, 1))
}

export function dayKey(month: string, day: number): string {
  return `${month}-${pad(day)}`
}

export function monthCells(month: string): (number | null)[] {
  const [y, m] = month.split('-').map(Number)
  const leading = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const days = new Date(y, m, 0).getDate()
  const cells: (number | null)[] = [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
