import { countAreas } from './permissionTree'
import type { Administrator, Group } from '../types'

type Me = { username?: string; superAdmin?: boolean } | null | undefined

/**
 * What the signed-in person may do to one account. The backend's rules: only a super admin edits or deletes
 * a super admin, and nobody deletes their own account. (The backend enforces them; this decides what to offer.)
 */
export function rowRules(admin: Administrator, me: Me): { lockedSuper: boolean; isSelf: boolean; canEdit: boolean; canDelete: boolean } {
  const lockedSuper = !!admin.superAdmin && !me?.superAdmin
  const isSelf = !!me?.username && admin.username === me.username
  return { lockedSuper, isSelf, canEdit: !lockedSuper, canDelete: !lockedSuper && !isSelf }
}

/** "Everything", or "3 areas · 2 helmets". */
export function describeAccess(admin: Administrator): string {
  if (admin.superAdmin) return 'Everything'
  const areas = countAreas(admin.permissions)
  const helmets = admin.deviceIds.length
  return `${areas} ${areas === 1 ? 'area' : 'areas'} · ${helmets ? `${helmets} ${helmets === 1 ? 'helmet' : 'helmets'}` : 'all helmets'}`
}

/** A group that no longer exists still leaves its id on the account: say so, rather than showing a blank. */
export function groupLabel(id: number | null | undefined, groups: readonly Group[]): { text: string; missing: boolean } {
  if (id == null) return { text: 'No group', missing: false }
  const found = groups.find((g) => g.id === id)
  return found ? { text: found.name, missing: false } : { text: `Missing group (${id})`, missing: true }
}

/** What stops a save, in the order to fix it (the web's rules). */
export function validateAdmin(values: { username: string; password: string; permissions: readonly unknown[] }, editing: boolean): string | null {
  if (values.username.trim().length < 2) return 'Account name is required.'
  if (!editing && values.password.length < 6) return 'Set a login password of at least 6 characters.'
  if (editing && values.password.length > 0 && values.password.length < 6) return 'A new password needs at least 6 characters.'
  if (values.permissions.length === 0) return 'Select at least one permission.'
  return null
}

type HttpError = { response?: { status?: number; data?: { error?: string; message?: string; permission?: string } } }

/** The backend's reason for refusing a save, in words an administrator can act on. */
export function saveErrorMessage(error: unknown, editing: boolean): string {
  const res = (error as HttpError)?.response
  if (res?.status === 403) {
    return res.data?.permission
      ? `You can't grant ${res.data.permission.replace(/_/g, ' ').toLowerCase()}: you don't hold it yourself.`
      : "You aren't allowed to make that change. Only a super admin can edit super admins."
  }
  if (res?.status === 409) return 'That account name is already in use.'
  if (res?.status === 400 && (res.data?.message || res.data?.error)) return `Not saved: ${res.data.message ?? res.data.error}.`
  return editing ? 'Could not save. Check your connection and try again.' : 'Could not create the account. Check your connection and try again.'
}

/** Why a delete was refused (Cypher, 20 Oct): not yourself (400), super admins only by a super admin (403), not the last one (409). */
/** Why a reset of someone's two-step verification was refused, in words that say what to do. */
export function resetErrorMessage(error: unknown): string {
  const res = (error as HttpError)?.response
  if (res?.status === 400) return "You can't reset your own two-step verification. Ask another administrator."
  if (res?.status === 403) return 'Only a super admin can reset a super admin.'
  if (res?.status === 404) return "That account no longer exists."
  if (res?.status) return 'The server had a problem. Try again shortly.'
  return "Couldn't reach the server. Check your connection and try again."
}

export function deleteErrorMessage(error: unknown): string {
  const res = (error as HttpError)?.response
  if (res?.status === 400) return "You can't delete your own account."
  if (res?.status === 403) return 'Only a super admin can delete a super admin.'
  if (res?.status === 409 && res.data?.error === 'last_super_admin') return "This is the last super admin, so it can't be deleted."
  return "Couldn't delete the account. Check your connection and try again."
}
