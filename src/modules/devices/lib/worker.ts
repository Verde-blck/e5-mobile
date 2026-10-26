import type { Worker } from '../types'

export const WORKER_NAME_MAX = 80

export interface WorkerForm {
  name: string
  staffId: string
  phone: string
}

export type WorkerErrors = Partial<Record<keyof WorkerForm, string>>

export function validateWorker(form: WorkerForm): WorkerErrors {
  const errors: WorkerErrors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Enter the worker’s name.'
  else if (name.length > WORKER_NAME_MAX) errors.name = `The name can be up to ${WORKER_NAME_MAX} characters.`
  return errors
}

export function workerPayload(form: WorkerForm): Worker {
  const staffId = form.staffId.trim()
  const phone = form.phone.trim()
  return { name: form.name.trim(), ...(staffId ? { staffId } : {}), ...(phone ? { phone } : {}) }
}

export function formFromWorker(worker?: Worker): WorkerForm {
  return { name: worker?.name ?? '', staffId: worker?.staffId ?? '', phone: worker?.phone ?? '' }
}

export function workerLabel(worker?: Worker): string {
  return worker?.name ?? 'Unassigned'
}

export function wornLabel(isWorn: boolean | undefined): string {
  return isWorn === true ? 'Yes' : isWorn === false ? 'No' : '–'
}

export function describeWorkerError(error: unknown): string {
  const e = error as { response?: { status?: number; data?: { error?: string; message?: string } } }
  const status = e?.response?.status
  if (!status) return "Couldn't reach the server. Check the connection and try again."
  if (status === 400) return e.response?.data?.message ?? 'Enter the worker’s name.'
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 403) return "This account isn't allowed to change who wears a helmet."
  if (status === 404) return "The server couldn't find that helmet."
  if (status >= 500) return 'The server had a problem. The connection is fine.'
  return `The server refused it (HTTP ${status}).`
}
