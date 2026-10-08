import type { ApiErrorBody } from '@/src/types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let csrfToken = ''

function errorMessage(body: ApiErrorBody | null, status: number): string {
  if (Array.isArray(body?.message)) return body.message.join(', ')
  return body?.message || body?.error || `Request gagal dengan status ${status}`
}

export async function refreshCsrf(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store' })
  const body = (await response.json().catch(() => null)) as { csrf?: string } | null
  if (!response.ok || !body?.csrf) throw new ApiError('Gagal menyiapkan keamanan sesi', response.status)
  csrfToken = body.csrf
  return csrfToken
}

export function clearCsrf(): void {
  csrfToken = ''
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const method = (init.method || 'GET').toUpperCase()
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken || (await refreshCsrf()))
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store'
  })
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? ((await response.json().catch(() => null)) as T | ApiErrorBody | null)
    : null
  if (!response.ok) {
    throw new ApiError(errorMessage(body as ApiErrorBody | null, response.status), response.status)
  }
  return body as T
}

export async function apiJson<T>(path: string, method: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    body: data === undefined ? undefined : JSON.stringify(data)
  })
}
