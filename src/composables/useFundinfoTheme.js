import { ref } from 'vue'

const STORAGE_KEY = 'fi32-theme'
const isDark = ref(false)
let initialized = false

function readInitialPreference() {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'dark') return true
    if (localStorage.getItem(STORAGE_KEY) === 'light') return false
  } catch (e) {}
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

function persist(dark) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch (e) {}
}

export function useFundinfoTheme() {
  if (!initialized) {
    isDark.value = readInitialPreference()
    initialized = true
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    persist(isDark.value)
  }

  return {
    isDark,
    toggleTheme,
  }
}