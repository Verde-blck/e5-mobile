export interface UploadProblem {
  message: string
  detail?: string
}

function serverText(data: unknown): string {
  if (typeof data === 'string') return data.trim().slice(0, 160)
  if (data && typeof data === 'object') {
    const o = data as { message?: unknown; error?: unknown; detail?: unknown }
    for (const v of [o.message, o.error, o.detail]) if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 160)
  }
  return ''
}

// "Check the connection" is only true when no answer came back; if the server answered, the connection
// was fine and the answer is what matters, so it is reported with its code and its own words.
export function describeUploadError(error: unknown, what = 'the recording'): UploadProblem {
  const e = error as { name?: string; message?: string; response?: { status?: number; data?: unknown } }
  const status = e?.response?.status
  if (!status) return { message: "Couldn't reach the server. Check the connection and try again.", detail: e?.message && e.message !== 'Network Error' ? e.message : undefined }
  const text = serverText(e.response?.data)
  const detail = `HTTP ${status}${text ? `: ${text}` : ''}`
  if (status === 401) return { message: 'Your session has expired. Sign in again.', detail }
  if (status === 403) return { message: "The server says this account isn't allowed to do that.", detail }
  if (status === 404) return { message: "The server couldn't find that helmet, or doesn't have this service.", detail }
  if (status === 413) return { message: `${what[0].toUpperCase()}${what.slice(1)} is too large for the server (the limit is about 10 MB).`, detail }
  if (status === 400 || status === 415 || status === 422) return { message: `The server didn't accept ${what}. It may not take this audio format.`, detail }
  if (status >= 500) return { message: 'The server had a problem handling it. The connection is fine.', detail }
  return { message: `The server refused it (HTTP ${status}).`, detail }
}
