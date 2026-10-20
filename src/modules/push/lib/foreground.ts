/**
 * Whether the system should also show a notification while the app is on screen. When the alarm
 * stream is connected the app already shows the SOS banner and plays its own siren, so a second
 * notification would just double up; when the stream has dropped, the notification is the only
 * warning, so it shows.
 */
export function shouldShowInForeground(state: { appActive: boolean; streamOpen: boolean }): boolean {
  return !(state.appActive && state.streamOpen)
}
