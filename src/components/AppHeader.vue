<script setup>
import { RouterLink } from 'vue-router'
import { useThemeStore } from '../stores/themeStore'
import SearchBar from './SearchBar.vue'

const theme = useThemeStore() // Global toggle, shared by every route

const navLinks = [
  { to: '/', label: 'หน้าหลัก' },
  { to: '/dashboard', label: 'FUNDINFO' },
  { to: '/insights', label: 'IDEAFUND' },
  { to: '/articles', label: 'บทความ/บทวิเคราะห์' },
  { to: '/Faq', label: 'คำถามที่พบบ่อย' },
]
</script>

<template>
  <header class="idea-nav">
    <RouterLink class="idea-logo" to="/" aria-label="IDEA FUND">
      <span>IDEA</span>
      <small>FUND</small>
    </RouterLink>

    <nav class="idea-menu" aria-label="เมนูหลัก">
      <RouterLink v-for="link in navLinks" :key="`${link.to}-${link.label}`" :to="link.to">
        {{ link.label }}
      </RouterLink>
    </nav>

    <div class="idea-nav-tools">
      <SearchBar />

      <button
        type="button"
        class="idea-theme-toggle"
        :aria-pressed="theme.isDark"
        :aria-label="theme.isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'"
        :title="theme.isDark ? 'Light mode' : 'Dark mode'"
        @click="theme.toggleTheme"
      >
        {{ theme.isDark ? '☀️' : '🌙' }}
      </button>

      <RouterLink class="idea-login" to="/login">เข้าสู่ระบบ</RouterLink>
    </div>
  </header>
</template>

<style scoped>
/* Self-contained so this button needs no changes to the global
   stylesheet; header bg is already dark by design, independent of
   the site-wide theme. */
.idea-theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.idea-theme-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

.idea-theme-toggle:focus-visible {
  outline: 2px solid #5b8cff;
  outline-offset: 2px;
}
</style>
