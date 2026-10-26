export function photoColumns(width: number): 2 | 3 | 4 {
  return width >= 1000 ? 4 : width >= 650 ? 3 : 2
}
