import { defineStore } from 'pinia'
import {
  accountInfo,
  forgotPassword,
  login,
  logout,
  profile,
  register,
  resetPassword,
  updateProfile,
  verify,
} from '../services/authApi'

const STORAGE_KEY = 'migrat.auth.v1'

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStoredAuth(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
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
      const stored = readStoredAuth()
      this.token = stored.token || ''
      this.user = stored.user || null
      this.account = stored.account || null
      this.restored = true
    },
    persist() {
      writeStoredAuth({
        token: this.token,
        user: this.user,
        account: this.account,
      })
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
        this.persist()
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
      this.persist()
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
