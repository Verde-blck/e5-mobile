import { unregisterPush } from '../api/push.api'
import { getInstallId } from './installId'

/**
 * Tells the backend this tablet should stop getting alarms for the account, on an ordinary sign-out.
 * Best effort with a short limit: signing out must never hang on the network. (A 401 can't do this
 * since the token is already dead, which is why the backend also drops registrations when an
 * account is deleted or its sessions are revoked: it's in the request to Cypher.)
 */
export async function unregisterThisTablet(timeoutMs = 3000): Promise<void> {
  try {
    const id = await getInstallId()
    await Promise.race([unregisterPush(id), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))])
  } catch {
    /* signing out goes ahead regardless */
  }
}
