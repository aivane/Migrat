import axios from 'axios'

const FUND_API_BASE_URL =
  import.meta.env.VITE_FUND_API_BASE_URL ||
  import.meta.env.VITE_FUND_API_RECON ||
  '/api/fund/api/v1'

const authBaseURL =
  import.meta.env.VITE_FUND_BACKEND ||
  '/api/backend'

const wpAjaxURL =
  import.meta.env.VITE_WP_AJAX_URL ||
  '/wp-admin/admin-ajax.php'

const wpRestBaseURL =
  import.meta.env.VITE_WP_REST_URL ||
  '/wp-json/wp/v2'

const DEFAULT_TIMEOUT_MS = 30000
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/%]*$/
const SAFE_AUTH_TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{16,4096}$/
const SAFE_CSRF_TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{16,1024}$/

export const apiMode = import.meta.env.VITE_API_MODE || 'direct'

// Error Handling — callers receive only a safe, user-appropriate message.
export class ApiRequestError extends Error {
  constructor(message = 'ไม่สามารถเชื่อมต่อข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง') {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function toSafeRequestError(error) {
  if (error instanceof ApiRequestError) return error

  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
    return new ApiRequestError('คำขอถูกยกเลิก กรุณาลองใหม่อีกครั้ง')
  }

  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return new ApiRequestError('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง')
  }

  if (error?.response?.status === 429) {
    return new ApiRequestError('มีการร้องขอข้อมูลมากเกินไป กรุณาลองใหม่อีกครั้ง')
  }

  return new ApiRequestError()
}

function setHeader(headers, name, value) {
  if (typeof headers?.set === 'function') {
    headers.set(name, value)
    return
  }

  headers[name] = value
}

function isSameOriginRequest(config) {
  if (typeof window === 'undefined') return false

  try {
    const baseURL = new URL(config.baseURL || '/', window.location.origin)
    const requestURL = new URL(config.url || '', baseURL)
    return requestURL.origin === window.location.origin
  } catch {
    return false
  }
}

function csrfTokenFromMeta() {
  if (typeof document === 'undefined') return ''

  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')?.trim() || ''
  return SAFE_CSRF_TOKEN_PATTERN.test(token) ? token : ''
}

function isUnsafeMethod(method) {
  return !['get', 'head', 'options'].includes(String(method || 'get').toLowerCase())
}

function createClient({ baseURL, timeout = DEFAULT_TIMEOUT_MS, ngrok = false }) {
  const client = axios.create({
    baseURL,
    timeout,
    withCredentials: false, // Auth — never send cross-origin cookies implicitly.
    xsrfCookieName: import.meta.env.VITE_CSRF_COOKIE_NAME || 'XSRF-TOKEN',
    xsrfHeaderName: import.meta.env.VITE_CSRF_HEADER_NAME || 'X-XSRF-TOKEN',
    headers: {
      Accept: 'application/json',
      ...(ngrok ? { 'ngrok-skip-browser-warning': '1' } : {}),
    },
  })

  client.interceptors.request.use((config) => {
    // API Hygiene — accept JSON only; Vue must render all API text with interpolation, never v-html.
    config.headers = config.headers || {}
    setHeader(config.headers, 'Accept', 'application/json')

    // CSRF — add a server-rendered token only for same-origin state-changing requests.
    // Axios handles the configured XSRF cookie independently when that scheme is used.
    if (isUnsafeMethod(config.method) && isSameOriginRequest(config)) {
      const csrfToken = csrfTokenFromMeta()
      if (csrfToken) setHeader(config.headers, import.meta.env.VITE_CSRF_HEADER_NAME || 'X-XSRF-TOKEN', csrfToken)
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(toSafeRequestError(error)), // Error Handling — no backend details reach UI/state.
  )

  return client
}

export const reconClient = createClient({ baseURL: FUND_API_BASE_URL, ngrok: true })
export const wpAjaxClient = createClient({ baseURL: wpAjaxURL, timeout: 60000 })
export const authClient = createClient({ baseURL: authBaseURL, ngrok: true })
export const wpRestClient = createClient({ baseURL: wpRestBaseURL })

function assertSafePath(path) {
  if (typeof path !== 'string' || !SAFE_PATH_PATTERN.test(path) || path.startsWith('//')) {
    throw new ApiRequestError('รูปแบบคำขอไม่ถูกต้อง')
  }
}

function cleanParams(params) {
  if (params == null) return {}
  if (Object.prototype.toString.call(params) !== '[object Object]') {
    throw new ApiRequestError('รูปแบบคำขอไม่ถูกต้อง')
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  )
}

function authHeaders(token) {
  if (!token) return undefined
  if (typeof token !== 'string' || !SAFE_AUTH_TOKEN_PATTERN.test(token)) {
    throw new ApiRequestError('ข้อมูลการยืนยันตัวตนไม่ถูกต้อง')
  }

  return { Authorization: `Bearer ${token}` }
}

export function unwrapResponse(response) {
  const payload = response?.data ?? response

  if (payload?.success === false || payload?.status === 'error') {
    throw new ApiRequestError()
  }

  if ((payload?.success === true || payload?.status === 'success') && 'data' in payload) {
    return payload.data
  }

  return payload
}

export async function wpGet(action, params = {}) {
  if (typeof action !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(action)) {
    throw new ApiRequestError('รูปแบบคำขอไม่ถูกต้อง')
  }

  const response = await wpAjaxClient.get('', {
    params: { action, ...cleanParams(params) },
  })

  return unwrapResponse(response)
}

export async function wpPost(action, data = {}) {
  if (typeof action !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(action)) {
    throw new ApiRequestError('รูปแบบคำขอไม่ถูกต้อง')
  }

  const body = new URLSearchParams()
  body.set('action', action)

  Object.entries(cleanParams(data)).forEach(([key, value]) => {
    if (typeof value === 'object') throw new ApiRequestError('รูปแบบคำขอไม่ถูกต้อง')
    body.set(key, String(value))
  })

  const response = await wpAjaxClient.post('', body)
  return unwrapResponse(response)
}

export async function reconGet(path, params = {}) {
  assertSafePath(path)
  const response = await reconClient.get(path, { params: cleanParams(params) })
  return unwrapResponse(response)
}

export async function reconPost(path, data = {}, params = {}) {
  assertSafePath(path)
  const response = await reconClient.post(path, data, { params: cleanParams(params) })
  return unwrapResponse(response)
}

export async function authGet(path, token = '') {
  assertSafePath(path)
  const response = await authClient.get(path, { headers: authHeaders(token) })
  return unwrapResponse(response)
}

export async function authPost(path, data = {}, token = '') {
  assertSafePath(path)
  const response = await authClient.post(path, data, { headers: authHeaders(token) })
  return unwrapResponse(response)
}

export async function wpRestGet(path, params = {}) {
  assertSafePath(path)
  const response = await wpRestClient.get(path, { params: cleanParams(params) })

  return {
    data: response.data,
    total: Number(response.headers?.['x-wp-total'] || 0),
    totalPages: Number(response.headers?.['x-wp-totalpages'] || 0),
  }
}
