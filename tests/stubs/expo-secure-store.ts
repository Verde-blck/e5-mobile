const mem = new Map<string, string>()
export const __mem = mem
export async function getItemAsync(k: string) { return mem.get(k) ?? null }
export async function setItemAsync(k: string, v: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('Invalid SecureStore key: ' + k)
  mem.set(k, v)
}
export async function deleteItemAsync(k: string) { mem.delete(k) }
