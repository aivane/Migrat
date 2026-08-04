import axios from 'axios'

const reconBaseURL =
  import.meta.env.VITE_FUND_API_RECON ||
  '/api/recon/v2'

const authBaseURL =
  import.meta.env.VITE_FUND_BACKEND ||
  '/api/backend'

const wpAjaxURL =
  import.meta.env.VITE_WP_AJAX_URL ||
  '/wp-admin/admin-ajax.php'

const wpRestBaseURL =
  import.meta.env.VITE_WP_REST_URL ||
  '/wp-json/wp/v2'

export const apiMode = import.meta.env.VITE_API_MODE || 'direct'

export const reconClient = axios.create({
  baseURL: reconBaseURL,
  timeout: 60000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
})

export const wpAjaxClient = axios.create({
  baseURL: wpAjaxURL,
  timeout: 60000,
})

export const authClient = axios.create({
  baseURL: authBaseURL,
  timeout: 30000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
})

export const wpRestClient = axios.create({
  baseURL: wpRestBaseURL,
  timeout: 30000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
})

export function unwrapResponse(response) {
  const payload = response?.data ?? response

  if (payload && payload.success === true && 'data' in payload) {
    return payload.data
  }

  if (payload && payload.success === false && 'data' in payload) {
    throw payload.data
  }

  return payload
}

export async function wpGet(action, params = {}) {
  const response = await wpAjaxClient.get('', {
    params: { action, ...params },
  })

  return unwrapResponse(response)
}

export async function wpPost(action, data = {}) {
  const body = new URLSearchParams()
  body.set('action', action)

  Object.entries(data).forEach(([key, value]) => {
    body.set(key, value)
  })

  const response = await wpAjaxClient.post('', body)
  return unwrapResponse(response)
}

export async function reconGet(path, params = {}) {
  const response = await reconClient.get(path, { params })
  return unwrapResponse(response)
}

export async function reconPost(path, data = {}, params = {}) {
  const response = await reconClient.post(path, data, { params })
  return unwrapResponse(response)
}

export async function authGet(path, token = '') {
  const response = await authClient.get(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  return unwrapResponse(response)
}

export async function authPost(path, data = {}, token = '') {
  const response = await authClient.post(path, data, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  return unwrapResponse(response)
}

export async function wpRestGet(path, params = {}) {
  const response = await wpRestClient.get(path, { params })

  return {
    data: response.data,
    total: Number(response.headers?.['x-wp-total'] || 0),
    totalPages: Number(response.headers?.['x-wp-totalpages'] || 0),
  }
}
