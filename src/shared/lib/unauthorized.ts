// The web dashboard signals a dead session with window.dispatchEvent; React
// Native has no window, so this is the same thing as a tiny emitter.
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

// 403 2fa_setup_required is not a dead session (signing out would only
// send the person round in a circle): it means go and set up 2FA.
const setupListeners = new Set<Listener>()

export function onSetupRequired(listener: Listener): () => void {
  setupListeners.add(listener)
  return () => {
    setupListeners.delete(listener)
  }
}

export function emitSetupRequired(): void {
  setupListeners.forEach((listener) => listener())
}

// An admin resetting this person's password while they are signed in makes the backend refuse everything with
// 403 password_change_required until they choose their own. Like the 2FA case it is not a dead session.
const passwordListeners = new Set<Listener>()

export function onPasswordChangeRequired(listener: Listener): () => void {
  passwordListeners.add(listener)
  return () => {
    passwordListeners.delete(listener)
  }
}

export function emitPasswordChangeRequired(): void {
  passwordListeners.forEach((listener) => listener())
}
