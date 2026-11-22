export type PushPlatform = 'android' | 'ios'

/** What to tell the backend this device is. Anything that is not an Apple device counts as Android, which is all the sample-data preview needs. */
export function registrationPlatform(os: string): PushPlatform {
  return os === 'ios' ? 'ios' : 'android'
}

/** Android and the preview follow the general push switch. Apple devices have their own, off until the backend accepts them. */
export function isPushEnabled(os: string, flags: { pushEnabled: boolean; pushIosEnabled: boolean }): boolean {
  return os === 'ios' ? flags.pushIosEnabled : flags.pushEnabled
}
