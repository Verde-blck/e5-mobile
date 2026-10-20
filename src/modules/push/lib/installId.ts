import { storage } from '@/shared/lib/storage'

const KEY = 'push.installId'
let cached: string | null = null

/**
 * A random id for this installation of the app, kept across sign-outs. The backend keys a tablet's
 * registration on it, so signing in again (or a refreshed token) updates the same record instead
 * of piling up duplicates. It is an identifier, not a secret.
 */
export async function getInstallId(): Promise<string> {
  if (cached) return cached
  const saved = await storage.get(KEY)
  if (saved && /^[0-9a-f]{32}$/.test(saved)) return (cached = saved)
  let id = ''
  for (let i = 0; i < 32; i += 1) id += Math.floor(Math.random() * 16).toString(16)
  await storage.set(KEY, id)
  cached = id
  return id
}

/** For tests. */
export function resetInstallIdCache(): void {
  cached = null
}
