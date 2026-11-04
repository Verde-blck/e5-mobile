import axios from 'axios'
import { env } from '@/config/env'
import { isForbidden, isPasswordChangeRequired, isSetupRequired } from './errors'
import { tokenStore } from './token'
import { emitPasswordChangeRequired, emitSetupRequired, emitUnauthorized } from './unauthorized'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
})

// Bearer token rather than a cookie, because that's what the API issues.
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 from these means the code or password was wrong, not that the session died:
// treating it as a dead session would sign the person out for mistyping a code.
const WRONG_INPUT_ENDPOINTS = ['/auth/login', '/auth/2fa/confirm', '/auth/2fa/disable', '/auth/change-password']

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''

    // A 401, or a 403 without the backend's {"error":"forbidden"} body, means the token has expired.
    if (isSetupRequired(error)) {
      emitSetupRequired()
      return Promise.reject(error)
    }
    if (isPasswordChangeRequired(error)) {
      emitPasswordChangeRequired()
      return Promise.reject(error)
    }
    const sessionDead = status === 401 || (status === 403 && !isForbidden(error))

    if (sessionDead && !WRONG_INPUT_ENDPOINTS.some((path) => url.includes(path))) {
      emitUnauthorized()
    }

    return Promise.reject(error)
  }
)
