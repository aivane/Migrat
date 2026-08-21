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

const STORAGE_KEY = 'migrat.auth.v1'

// Secure State — localStorage is JS-readable by any script on the page, so an
// XSS anywhere in the app can exfiltrate anything stored here. We can't avoid
// persisting *something* across reloads without an httpOnly cookie from the
// backend, so we minimize the blast radius: only the bearer token is kept,
// never `user`/`account` (PII — display name, email, etc.). Callers must
// re-fetch profile data via loadProfile() after restore() instead of trusting
// a stale cached copy.
function readStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw).token || '' : ''
  } catch {
    return ''
  }
}

function writeStoredToken(token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }))
  } catch {
    // Runtime auth state is still available even if localStorage is blocked.
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
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
      // Only the token survives a reload — user/account are re-fetched fresh
      // via loadProfile() by the caller, never trusted from storage.
      this.token = readStoredToken()
      this.restored = true
    },
    persist() {
      writeStoredToken(this.token)
    },
    async loginWithPassword(credentials) {
      this.loading = true
      this.error = ''

      try {
        const payload = await login(credentials)
        this.token = payload.token || payload.access_token || ''
        this.user = payload.user || payload.profile || payload
        this.persist()
        return payload
      } catch (error) {
        this.error = error?.message || error?.error || 'เข้าสู่ระบบไม่สำเร็จ'
        throw error
      } finally {
        this.loading = false
      }
    },
    async loginWithGoogle(credential) {
      this.loading = true
      this.error = ''

      try {
        const payload = await googleVerify(credential)
        this.token = payload.token || payload.access_token || ''
        this.user = payload.user || payload.profile || payload
        this.persist()
        return payload
      } catch (error) {
        this.error = error?.message || error?.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
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
        return await register(payload)
      } catch (error) {
        this.error = error?.message || error?.error || 'สมัครสมาชิกไม่สำเร็จ'
        throw error
      } finally {
        this.loading = false
      }
    },
    async loadProfile() {
      if (!this.token) return null

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
        this.error = error?.message || error?.error || 'โหลดข้อมูลบัญชีไม่สำเร็จ'
        throw error
      } finally {
        this.loading = false
      }
    },
    async verifyToken() {
      if (!this.token) return false

      try {
        await verify(this.token)
        return true
      } catch {
        this.clearAuth()
        return false
      }
    },
    async updateDisplayName(displayName) {
      if (!this.token) return null

      const payload = await updateProfile({ token: this.token, displayName })
      this.user = { ...(this.user || {}), display_name: displayName }
      // No persist() — display_name is PII, kept in memory only (see restore()).
      return payload
    },
    async requestPasswordReset(email) {
      return forgotPassword(email)
    },
    async resetPasswordWithToken(payload) {
      return resetPassword(payload)
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
      clearStoredAuth()
    },
  },
})
