/** One helmet's entry in the backend's answer to a broadcast. */
export interface Delivery {
  deviceId: string
  /** True when the helmet was reachable and is playing it now; false when it was queued for later. */
  delivered: boolean
  /** The copy of the message this helmet was given. */
  messageId?: number
}

/**
 * What happened for one helmet. sent: plays now. queued: offline, plays on reconnect. failed: not accepted.
 * The outcome stays per helmet: a partial result has to be visible, not averaged into one success message.
 */
export type OutcomeStatus = 'sent' | 'queued' | 'failed'

export interface Outcome {
  deviceId: string
  deviceName: string
  status: OutcomeStatus
}

export interface Target {
  id: string
  name: string
}
