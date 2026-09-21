import { storeToRefs } from 'pinia'
import { useThemeStore } from '../stores/themeStore'

// Thin wrapper: reads/writes the SAME global store as App.vue/AppHeader.vue
// instead of a second disconnected ref — that split used to leave fundinfo
// dark mode out of sync with the rest of the app.
export function useFundinfoTheme() {
  const store = useThemeStore()
  store.init() // idempotent — safe even if called before App.vue mounts

  const { isDark } = storeToRefs(store) // preserves reactivity for callers

  return {
    isDark,
    toggleTheme: store.toggleTheme,
  }
}
