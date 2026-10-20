export type MessageDirection = 'TO_HELMET' | 'FROM_HELMET'

/** One voice message in a helmet's conversation: sent to it, or recorded by the wearer. */
export interface VoiceMessage {
  id: number
  deviceId: string
  direction: MessageDirection
  /** A signed link that expires after about an hour; empty if the recording is gone. */
  audioUrl: string
  createdAt: number
}

export interface SendResult {
  messageId: number
  audioUrl: string
  /** False: the helmet is offline. The message is queued and plays when it reconnects. */
  delivered: boolean
}
