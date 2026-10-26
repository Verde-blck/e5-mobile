export type MessageDirection = 'TO_HELMET' | 'FROM_HELMET'

export interface VoiceMessage {
  id: number
  deviceId: string
  direction: MessageDirection
  audioUrl: string
  createdAt: number
}

export interface SendResult {
  messageId: number
  audioUrl: string
  delivered: boolean
}
