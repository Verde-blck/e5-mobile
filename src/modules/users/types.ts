import type { ApiPermission } from '@/shared/constants/backend-permissions'

/**
 * An administrator account, matching GET /api/admins. `role` and `department` are free text on the account,
 * and permissions attach directly to it (not through a shared role): the backend doesn't model roles.
 */
export interface Administrator {
  id: number
  username: string
  department?: string | null
  role?: string | null
  mobilePhone?: string | null
  groupId?: number | null
  permissions: ApiPermission[]
  /** Helmets this administrator is limited to. Empty means no restriction. */
  deviceIds: string[]
  /** Full access. Only a super admin can edit or delete one. */
  superAdmin?: boolean
  twoFactorEnabled?: boolean
}

export interface NewAdministrator {
  username: string
  password: string
  department?: string
  role?: string
  mobilePhone?: string
  groupId?: number | null
  permissions: ApiPermission[]
  deviceIds: string[]
}

/** Editing omits the password unless it is being changed. */
export type AdministratorUpdate = Partial<Omit<NewAdministrator, 'password'>> & { password?: string }

export interface Group {
  id: number
  name: string
  createdBy?: string | null
}
