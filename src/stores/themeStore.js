import { defineStore } from 'pinia'

// Non-sensitive UI preference only (never store tokens/PII here).
const STORAGE_KEY = 'migrat.theme'

function readSystemPreference() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

function readStoredPreference() {
  try {
    // Anti-XSS: value is validated against a strict allow-list below,
    // never interpolated into HTML/attributes and never eval'd.
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light') return raw
  } catch (e) {
    // localStorage may be unavailable (privacy mode, disabled cookies, etc.)
  }
  return null
}

function persistPreference(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value === 'dark' ? 'dark' : 'light')
  } catch (e) {
    // Fail silently: theme still works in-memory for this session.
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: false,
    initialized: false,
  }),
  actions: {
    // Call once, from App.vue's onMounted. Idempotent.
    init() {
      if (this.initialized) return
      const stored = readStoredPreference()
      this.isDark = stored ? stored === 'dark' : readSystemPreference()
      this.initialized = true
    },
    setDark(value) {
      this.isDark = Boolean(value)
      persistPreference(this.isDark ? 'dark' : 'light')
    },
    toggleTheme() {
      this.setDark(!this.isDark)
    },
  },
})
