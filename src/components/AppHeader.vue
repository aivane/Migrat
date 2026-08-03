<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

const router = useRouter()
const searchText = ref('')

const navLinks = [
  { to: '/', label: 'หน้าหลัก' },
  { to: '/dashboard', label: 'FUNDINFO' },
  { to: '/insights', label: 'IDEAFUND' },
  { to: '/articles', label: 'บทความ/บทวิเคราะห์' },
  { to: '/Faq', label: 'คำถามที่พบบ่อย' },
]

function goSearch() {
  const symbols = searchText.value
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .join(',')

  router.push(symbols ? `/dashboard?symbols=${encodeURIComponent(symbols)}` : '/dashboard')
}
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
      <form class="idea-search" @submit.prevent="goSearch">
        <input v-model="searchText" type="search" placeholder="ค้นหากองทุน / หุ้น..." />
        <button type="submit" aria-label="ค้นหา">⌕</button>
      </form>
      <RouterLink class="idea-login" to="/login">เข้าสู่ระบบ</RouterLink>
    </div>
  </header>
</template>
