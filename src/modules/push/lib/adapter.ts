export type PermissionState = 'granted' | 'denied' | 'undetermined'

export interface PushAdapter {
  isSupported(): boolean
  setup(): Promise<void>
  permission(): Promise<PermissionState>
  requestPermission(): Promise<PermissionState>
  getToken(): Promise<string>
  onTokenChange(callback: (token: string) => void): () => void
  onReceive(callback: (data: unknown) => void): () => void
  onTap(callback: (data: unknown) => void): () => void
  initialTap(): unknown | null
  dismiss(alarmId: string): Promise<void>
  sendTest(): Promise<void>
  openSettings(): Promise<void>
  openBatterySettings(): Promise<void>
}
