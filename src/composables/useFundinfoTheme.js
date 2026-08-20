import { storeToRefs } from 'pinia'
import { useThemeStore } from '../stores/themeStore'

// Thin compatibility wrapper: FundinfoLayout.vue (and anything else
// still importing this) now reads/writes the SAME global store as
// App.vue and AppHeader.vue, instead of a second, disconnected
// module-level ref. This is what kept fundinfo dark mode from
// following the rest of the app: two independent sources of truth.
export function useFundinfoTheme() {
  const store = useThemeStore()
  store.init() // idempotent — safe even if called before App.vue mounts

  const { isDark } = storeToRefs(store) // preserves reactivity for callers

  return {
    isDark,
    toggleTheme: store.toggleTheme,
  }
}
