import { apiMode, authGet, authPost, wpGet, wpPost } from './apiClient'

function normalizeAuth(payload) {
  return payload?.data || payload || {}
}

export async function login({ username, password, remember = false }) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_login', { username, password, remember: remember ? '1' : '0' }))
  }

  return normalizeAuth(await authPost('/api/auth/login', { username, password, remember_me: remember }))
}

export async function register({ username, email, password }) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_register', { username, email, password }))
  }

  return normalizeAuth(await authPost('/api/auth/register', { username, email, password }))
}

export async function logout() {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_logout'))
  }

  return { message: 'ok' }
}

export async function verify(token) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_verify', { token }))
  }

  return normalizeAuth(await authGet('/api/auth/verify', token))
}

export async function profile(token) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_profile', { token }))
  }

  return normalizeAuth(await authGet('/api/auth/profile', token))
}

export async function accountInfo(token) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_account_info', { token }))
  }

  return normalizeAuth(await authGet('/api/auth/account-info', token))
}

export async function forgotPassword(email) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_forgot', { email }))
  }

  return normalizeAuth(await authPost('/api/auth/forgot-password', { email }))
}

export async function resetPassword({ token, password }) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_reset_pw', { token, password }))
  }

  return normalizeAuth(await authPost('/api/auth/reset-password', { token, new_password: password }))
}

export async function updateProfile({ token, displayName }) {
  if (apiMode === 'wordpress') {
    return normalizeAuth(await wpPost('fund_update_profile', { token, display_name: displayName }))
  }

  return normalizeAuth(await authPost('/api/auth/update-profile', { display_name: displayName }, token))
}
