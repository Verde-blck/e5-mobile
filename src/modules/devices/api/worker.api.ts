import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { getMockDevice, setMockWorker } from './devices.mock'
import { toDevice } from './devices.api'
import type { Device, Worker } from '../types'

/*
 * Who is assigned to wear a helmet (backend update of 21 Oct 2026). Needs MONITORING_CENTER_MANAGE.
 *
 *   PUT    /api/devices/{id}/worker   { name, staffId?, phone? }   -> the helmet
 *   DELETE /api/devices/{id}/worker                                -> the helmet
 *
 * Only the name is required (up to 80). Alarm notifications then name the worker: "SOS: John Ade (ES5 3)".
 */
export async function assignWorker(deviceId: string, worker: Worker): Promise<Device> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (!worker.name.trim()) throw Object.assign(new Error('name required'), { response: { status: 400, data: { message: 'name is required' } } })
    setMockWorker(deviceId, worker)
    return getMockDevice(deviceId) as Device
  }
  const { data } = await apiClient.put(`/devices/${deviceId}/worker`, worker)
  return toDevice(data)
}

export async function removeWorker(deviceId: string): Promise<Device> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    setMockWorker(deviceId, null)
    return getMockDevice(deviceId) as Device
  }
  const { data } = await apiClient.delete(`/devices/${deviceId}/worker`)
  return toDevice(data)
}
