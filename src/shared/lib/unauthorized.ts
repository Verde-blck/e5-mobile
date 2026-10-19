/**
 * A one-line event channel between the axios client and the app shell.
 *
 * The web dashboard does this with window.dispatchEvent; React Native has no
 * window, so this is the same idea in plain TypeScript. It lives in its own
 * file with no imports on purpose: the API client needs to raise the event,
 * and the session code (which imports the API layer) needs to listen for it,
 * so putting both ends in one module would create an import cycle.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitUnauthorized(): void {
  listeners.forEach((listener) => listener())
}
