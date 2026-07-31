<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const email = ref('')
const message = ref('')

async function submitForgot() {
  message.value = ''

  try {
    await authStore.requestPasswordReset(email.value)
    message.value = 'ส่งคำขอ reset password แล้ว'
  } catch {
    message.value = authStore.error || 'ส่งคำขอไม่สำเร็จ'
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">Account</p>
      <h1>ลืมรหัสผ่าน</h1>
      <form class="auth-form" @submit.prevent="submitForgot">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <button type="submit">ส่งลิงก์ reset</button>
        <p v-if="message" class="auth-message">{{ message }}</p>
      </form>
      <nav class="auth-links">
        <RouterLink to="/login">กลับไปเข้าสู่ระบบ</RouterLink>
      </nav>
    </section>
  </main>
</template>
