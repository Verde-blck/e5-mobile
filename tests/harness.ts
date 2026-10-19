import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/shared/lib/api-client'

/** A tiny test runner: prints ok/FAIL per test and sets a failing exit code. */
export function createRunner() {
  const lines: string[] = []
  let passed = 0
  let total = 0

  async function t(name: string, fn: () => void | Promise<void>) {
    total++
    try {
      await fn()
      passed++
      lines.push('  ok  ' + name)
    } catch (e) {
      lines.push('FAIL  ' + name + '\n        ' + (e instanceof Error ? e.message : String(e)))
      process.exitCode = 1
    }
  }

  function report() {
    console.log(lines.join('\n'))
    console.log(`\n${passed}/${total} passed`)
    if (passed !== total) process.exitCode = 1
  }

  return { t, report }
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const jwt = (payload: object) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`
export const future = Math.floor(Date.now() / 1000) + 3600
export const past = Math.floor(Date.now() / 1000) - 3600

export interface Req {
  method?: string
  url?: string
  baseURL?: string
  params?: any
  data?: any
  auth?: string
}
export type Route = (req: Req) => { status: number; data?: any }

/**
 * Replaces axios's network layer, so the real client — its base URL, its
 * interceptors, its error handling — runs against canned responses.
 * status 0 means "no response at all" (offline).
 */
export function installHttp() {
  const state = { calls: [] as Req[], routes: {} as Record<string, Route> }

  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const req: Req = {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      params: config.params,
      data: config.data ? JSON.parse(config.data) : undefined,
      auth: (config.headers as any)?.Authorization,
    }
    state.calls.push(req)
    const route = state.routes[`${req.method} ${req.url}`]
    const res = route ? route(req) : { status: 404, data: { error: 'no route' } }
    if (res.status === 0) throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    const response = { data: res.data, status: res.status, statusText: '', headers: {}, config }
    if (res.status >= 400)
      throw new AxiosError('HTTP ' + res.status, 'ERR_BAD_REQUEST', config, null, response as any)
    return response
  }
  return state
}
