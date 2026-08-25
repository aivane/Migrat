import { defineStore } from 'pinia'
import {
  accountInfo,
  forgotPassword,
  googleUrl,
  googleVerify,
  login,
  logout,
  profile,
  register,
  resetPassword,
  updateProfile,
  verify,
} from '../services/authApi'

const LEGACY_STORAGE_KEY = 'migrat.auth.v1'
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/
const EMAIL_PATTERN = /^[^\s@]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,63}$/
const SECRET_PATTERN = /^[^\s\u0000-\u001F\u007F]{8,128}$/
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{16,4096}$/
const GOOGLE_CREDENTIAL_PATTERN = /^[A-Za-z0-9._~+/=-]{20,12000}$/

function clearLegacyStoredAuth() {
  // Secure State — remove token data written by earlier builds. This app never
  // reads or writes bearer credentials to Web Storage.
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Storage may be unavailable; the in-memory state remains safe.
  }
}

function validationError(message) {
  const error = new Error(message)
  error.name = 'AuthValidationError'
  return error
}

function safeAuthError(error, fallback) {
  return error?.name === 'AuthValidationError' ? error.message : fallback
}

function isRecord(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function normalizeUsername(value) {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!USERNAME_PATTERN.test(username) && !EMAIL_PATTERN.test(username)) {
    throw validationError('กรุณากรอก Username หรือ Email ให้ถูกต้อง')
  }
  return username
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) throw validationError('กรุณากรอกอีเมลให้ถูกต้อง')
  return email
}

function normalizeSecret(value, label = 'รหัสผ่าน') {
  if (typeof value !== 'string' || !SECRET_PATTERN.test(value)) {
    throw validationError(`${label}ต้องมีความยาว 8–128 ตัวอักษร และไม่มีอักขระควบคุม`)
  }
  return value
}

function validateLoginCredentials(credentials) {
  if (!isRecord(credentials)) throw validationError('รูปแบบข้อมูลเข้าสู่ระบบไม่ถูกต้อง')

  return {
    username: normalizeUsername(credentials.username),
    password: normalizeSecret(credentials.password),
    remember: credentials.remember === true,
  }
}

function validateRegistration(payload) {
  if (!isRecord(payload)) throw validationError('รูปแบบข้อมูลสมัครสมาชิกไม่ถูกต้อง')

  return {
    username: normalizeUsername(payload.username),
    email: normalizeEmail(payload.email),
    password: normalizeSecret(payload.password),
  }
}

function extractSession(payload) {
  const token = payload?.token || payload?.access_token || ''
  if (!hasValidSessionToken(token)) {
    throw validationError('ไม่พบข้อมูลการยืนยันตัวตนที่ถูกต้อง')
  }

  // Secure State — never retain the response object because it contains its token.
  return {
    token,
    user: isRecord(payload?.user) ? payload.user : isRecord(payload?.profile) ? payload.profile : null,
  }
}

function hasValidSessionToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token)
}

function normalizeDisplayName(value) {
  const displayName = typeof value === 'string' ? value.trim() : ''
  if (!displayName || displayName.length > 100 || /[\u0000-\u001F\u007F]/.test(displayName)) {
    throw validationError('ชื่อที่แสดงต้องมีความยาว 1–100 ตัวอักษร')
  }
  return displayName
}

function validatePasswordReset(payload) {
  if (!isRecord(payload) || !hasValidSessionToken(payload.token)) {
    throw validationError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง')
  }

  return { token: payload.token, password: normalizeSecret(payload.password) }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null,
    account: null,
    loading: false,
    error: '',
    restored: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    displayName: (state) =>
      state.user?.display_name ||
      state.user?.username ||
      state.account?.display_name ||
      state.account?.email ||
      '',
  },
  actions: {
    restore() {
      // Secure State — a reload starts unauthenticated unless the backend adds
      // an httpOnly-cookie session bootstrap endpoint in the future.
      clearLegacyStoredAuth()
      this.restored = true
    },
    async loginWithPassword(credentials) {
      this.loading = true
      this.error = ''

      try {
        const payload = await login(validateLoginCredentials(credentials))
        const session = extractSession(payload)
        this.token = session.token
        this.user = session.user
        return payload
      } catch (error) {
        this.error = safeAuthError(error, 'เข้าสู่ระบบไม่สำเร็จ')
        throw error
      } finally {
        this.loading = false
      }
    },
    async loginWithGoogle(credential) {
      this.loading = true
      this.error = ''

      try {
        if (typeof credential !== 'string' || !GOOGLE_CREDENTIAL_PATTERN.test(credential)) {
          throw validationError('ข้อมูลยืนยันตัวตนจาก Google ไม่ถูกต้อง')
        }

        const payload = await googleVerify(credential)
        const session = extractSession(payload)
        this.token = session.token
        this.user = session.user
        return payload
      } catch (error) {
        this.error = safeAuthError(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
        throw error
      } finally {
        this.loading = false
      }
    },
    async getGoogleClientId() {
      // ลอง env variable ก่อน (เร็วกว่า ไม่ต้องรอ backend)
      const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (envClientId) return envClientId

      // ถ้าไม่มีใน env ค่อยดึงจาก backend
      try {
        const data = await googleUrl()
        if (data?.client_id) return data.client_id
        if (data?.url) {
          const match = data.url.match(/client_id=([^&]+)/)
          return match ? decodeURIComponent(match[1]) : null
        }
        return null
      } catch {
        return null
      }
    },
    async registerAccount(payload) {
      this.loading = true
      this.error = ''

      try {
        return await register(validateRegistration(payload))
      } catch (error) {
        this.error = safeAuthError(error, 'สมัครสมาชิกไม่สำเร็จ')
        throw error
      } finally {
        this.loading = false
      }
    },
    async loadProfile() {
      if (!hasValidSessionToken(this.token)) {
        this.clearAuth()
        return null
      }

      this.loading = true
      this.error = ''

      try {
        const [profilePayload, accountPayload] = await Promise.all([
          profile(this.token),
          accountInfo(this.token),
        ])
        this.user = profilePayload.user || profilePayload.profile || profilePayload
        this.account = accountPayload.account || accountPayload
        // No persist() here — user/account are intentionally memory-only (PII),
        // token in storage is unchanged by a profile fetch.
        return this.user
      } catch (error) {
        this.error = safeAuthError(error, 'โหลดข้อมูลบัญชีไม่สำเร็จ')
        throw error
      } finally {
        this.loading = false
      }
    },
    async verifyToken() {
      if (!hasValidSessionToken(this.token)) {
        this.clearAuth()
        return false
      }

      try {
        await verify(this.token)
        return true
      } catch {
        this.clearAuth()
        return false
      }
    },
    async updateDisplayName(displayName) {
      if (!hasValidSessionToken(this.token)) {
        this.clearAuth()
        return null
      }

      const safeDisplayName = normalizeDisplayName(displayName)
      const payload = await updateProfile({ token: this.token, displayName: safeDisplayName })
      this.user = { ...(this.user || {}), display_name: safeDisplayName }
      // No persist() — display_name is PII, kept in memory only (see restore()).
      return payload
    },
    async requestPasswordReset(email) {
      return forgotPassword(normalizeEmail(email))
    },
    async resetPasswordWithToken(payload) {
      return resetPassword(validatePasswordReset(payload))
    },
    async logoutUser() {
      try {
        await logout()
      } finally {
        this.clearAuth()
      }
    },
    clearAuth() {
      this.token = ''
      this.user = null
      this.account = null
      this.error = ''
      clearLegacyStoredAuth()
    },
  },
})
