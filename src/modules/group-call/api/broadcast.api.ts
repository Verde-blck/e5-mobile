import { env } from '@/config/env'

/** Sending a voice message isn't switched on in this build. */
export class BroadcastUnavailable extends Error {
  constructor() {
    super('Sending voice messages is not switched on in this build yet.')
    this.name = 'BroadcastUnavailable'
  }
}

/**
 * Whether the app offers sending a voice message at all (never a button that can only fail). A voice message goes to
 * one helmet, from its own screen; there is no sending to several at once.
 */
export const broadcastAvailable = () => env.useMocks || env.broadcastEnabled
