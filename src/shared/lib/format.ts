export function formatCoord(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(5)
}

export function formatDateTime(ms: number | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
