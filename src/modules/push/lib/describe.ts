import type { PushStatus } from '../types'

export interface StatusCopy {
  title: string
  detail: string
  tone: 'ok' | 'warn' | 'info'
  /** What the button should do, if there is one. */
  action?: 'enable' | 'settings' | 'retry'
}

/** What to tell the person about alarm alerts, for each state. */
export function describeStatus(status: PushStatus): StatusCopy {
  switch (status) {
    case 'on':
      return { tone: 'ok', title: 'Alarm alerts are on', detail: 'SOS and other alarms will reach this tablet even when the screen is locked.' }
    case 'registering':
      return { tone: 'info', title: 'Setting up alerts…', detail: 'This only takes a moment.' }
    case 'needs-permission':
      return { tone: 'warn', title: 'Turn on alarm alerts', detail: 'Allow notifications so SOS and other alarms reach this tablet even when the screen is locked.', action: 'enable' }
    case 'blocked':
      return { tone: 'warn', title: 'Notifications are blocked', detail: "Allow them in the tablet's settings so SOS alarms can reach you when the screen is locked.", action: 'settings' }
    case 'error':
      return { tone: 'warn', title: "Couldn't set up alerts", detail: 'The app still works, but alarms may not reach you when the screen is locked. Check the connection and try again.', action: 'retry' }
    case 'unavailable':
      return { tone: 'info', title: "This tablet can't receive alerts", detail: 'It has no Google services, or this build has no alert setup. Keep the app open with the screen on to hear alarms.' }
    case 'off':
      return { tone: 'info', title: 'Alerts while locked: not on yet', detail: 'Until they are, keep this app open with the screen on to hear alarms.' }
  }
}
