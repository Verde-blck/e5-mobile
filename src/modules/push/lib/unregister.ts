import { unregisterPush } from '../api/push.api'
import { getInstallId } from './installId'

// Best effort with a short limit: signing out must never hang on the network.
export async function unregisterThisTablet(timeoutMs = 3000): Promise<void> {
  try {
    const id = await getInstallId()
    await Promise.race([unregisterPush(id), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))])
  } catch {
    /* signing out goes ahead regardless */
  }
}
