import axios from 'axios'
import { env } from '@/config/env'
import { isForbidden, isSetupRequired } from './errors'
import { tokenStore } from './token'
import { emitSetupRequired, emitUnauthorized } from './unauthorized'

// Every module's api/*.api.ts file should import THIS, not axios directly —
// that keeps the base URL and auth in one place.
export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  // A phone on a patchy site connection should fail in a way the UI can show,
  // not hang on a spinner.
  timeout: 20_000,
})

// Bearer token rather than a cookie, because that's what the API issues.
apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Endpoints where a 401 means "that code or password was wrong", not "your
 * session died". Treating those as a dead session would sign the person out
 * for mistyping a code.
 */
const WRONG_INPUT_ENDPOINTS = ['/auth/login', '/auth/2fa/confirm', '/auth/2fa/disable']

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''

    // A 401 means the token is dead. So does a 403 *without* the backend's
    // {"error":"forbidden"} body — that is how an expired token comes back.
    // A 403 WITH that body is a permission refusal: the account is fine, it
    // just isn't allowed to do that, so it must not end the session.
    // 2FA still to be set up is neither: the session is fine, and the person is sent to set it up.
    if (isSetupRequired(error)) {
      emitSetupRequired()
      return Promise.reject(error)
    }
    const sessionDead = status === 401 || (status === 403 && !isForbidden(error))

    if (sessionDead && !WRONG_INPUT_ENDPOINTS.some((path) => url.includes(path))) {
      // The app shell listens for this and ends the session. Reaching into the
      // store from here would import React state into a plain module.
      emitUnauthorized()
    }

    return Promise.reject(error)
  }
)
