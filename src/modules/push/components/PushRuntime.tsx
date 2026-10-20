import { usePushSetup } from '../hooks/usePushSetup'

/** Renders nothing; keeps push alerts running while someone is signed in. */
export function PushRuntime() {
  usePushSetup()
  return null
}
