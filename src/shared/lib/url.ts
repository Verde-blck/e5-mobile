/** A base address and a path with exactly one slash between them, whatever slashes either end already has. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
