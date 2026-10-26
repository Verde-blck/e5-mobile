import {
  PERMISSION_TREE,
  allPermissionCodes,
  viewCodeOf,
  type ApiPermission,
  type PermissionNode,
} from '@/shared/constants/backend-permissions'

export type Grantable = ReadonlySet<string> | null

export function canGrant(grantable: Grantable, code: ApiPermission): boolean {
  return grantable === null || grantable.has(code) || (!code.endsWith('_MANAGE') && grantable.has(`${code}_MANAGE`))
}

export interface RowState {
  heading: boolean
  // The backend doesn't offer this code, so it isn't shown.
  hidden: boolean
  manage?: ApiPermission
  viewing: boolean
  managing: boolean
  viewAllowed: boolean
  manageAllowed: boolean
}

export function rowState(node: PermissionNode, granted: readonly ApiPermission[], available: readonly ApiPermission[], grantable: Grantable): RowState {
  const held = new Set(granted)
  const offered = new Set(available)
  const manage = node.manageCode && (offered.size === 0 || offered.has(node.manageCode)) ? node.manageCode : undefined
  return {
    heading: !node.code,
    hidden: !!node.code && offered.size > 0 && !offered.has(node.code),
    manage,
    viewing: !!node.code && (held.has(node.code) || (!!manage && held.has(manage))),
    managing: !!manage && held.has(manage),
    viewAllowed: !!node.code && canGrant(grantable, node.code),
    manageAllowed: !!manage && canGrant(grantable, manage),
  }
}

export function toggleView(granted: readonly ApiPermission[], node: PermissionNode): ApiPermission[] {
  if (!node.code) return [...granted]
  const next = new Set(granted)
  const on = next.has(node.code) || (!!node.manageCode && next.has(node.manageCode))
  if (on) {
    next.delete(node.code)
    if (node.manageCode) next.delete(node.manageCode)
  } else {
    next.add(node.code)
  }
  return [...next]
}

export function toggleManage(granted: readonly ApiPermission[], node: PermissionNode): ApiPermission[] {
  if (!node.code || !node.manageCode) return [...granted]
  const next = new Set(granted)
  if (next.has(node.manageCode)) {
    next.delete(node.manageCode)
    next.add(node.code)
  } else {
    next.add(node.manageCode)
    next.delete(node.code)
  }
  return [...next]
}

export function selectAll(available: readonly ApiPermission[], grantable: Grantable): ApiPermission[] {
  const offered = new Set(available)
  const best = new Map<string, ApiPermission>()
  for (const code of allPermissionCodes()) {
    if (offered.size > 0 && !offered.has(code)) continue
    if (!canGrant(grantable, code)) continue
    const area = viewCodeOf(code)
    if (!best.has(area) || code.endsWith('_MANAGE')) best.set(area, code)
  }
  return [...best.values()]
}

export function countAreas(codes: readonly string[]): number {
  return new Set(codes.map(viewCodeOf)).size
}

export function flattenTree(): Array<{ node: PermissionNode; depth: number }> {
  const out: Array<{ node: PermissionNode; depth: number }> = []
  const walk = (nodes: PermissionNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ node, depth })
      if (node.children) walk(node.children, depth + 1)
    }
  }
  walk(PERMISSION_TREE, 0)
  return out
}
