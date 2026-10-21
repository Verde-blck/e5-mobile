/** How many photo tiles across, by the width the grid really has: two on a phone, three on a tablet in portrait, four in landscape. */
export function photoColumns(width: number): 2 | 3 | 4 {
  return width >= 1000 ? 4 : width >= 650 ? 3 : 2
}
