<script setup>
import { onMounted, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import { useThemeStore } from './stores/themeStore'

const theme = useThemeStore()

onMounted(() => {
  theme.init() // Reads stored/system preference once, app-wide
  applyDarkClass(theme.isDark)
})

// Single DOM write point: toggling <html class="dark"> cascades the
// var(--bg)/var(--text)/etc. overrides in style.css to EVERY route,
// including ones that never import the theme store directly.
watch(
  () => theme.isDark,
  (isDark) => applyDarkClass(isDark),
)

function applyDarkClass(isDark) {
  // Anti-XSS: boolean-driven classList toggle only, no string/HTML
  // interpolation into the DOM.
  document.documentElement.classList.toggle('dark', Boolean(isDark))
}
</script>

<template>
  <AppHeader />
  <RouterView />
</template>
