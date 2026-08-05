<script setup>
import { RouterLink } from 'vue-router'
import SearchBar from './SearchBar.vue'

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
      <RouterLink class="idea-login" to="/login">เข้าสู่ระบบ</RouterLink>
    </div>
  </header>
</template>
