<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
  remember: true,
})

const message = ref('')

async function submitLogin() {
  message.value = ''

  try {
    await authStore.loginWithPassword(form)
    router.push('/profile')
  } catch {
    message.value = authStore.error
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">Account</p>
      <h1>เข้าสู่ระบบ</h1>
      <form class="auth-form" @submit.prevent="submitLogin">
        <label>
          Username หรือ Email
          <input v-model="form.username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="current-password" required />
        </label>
        <label class="auth-check">
          <input v-model="form.remember" type="checkbox" />
          จดจำการเข้าสู่ระบบ
        </label>
        <button type="submit" :disabled="authStore.loading">
          {{ authStore.loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
        <p v-if="message" class="auth-error">{{ message }}</p>
      </form>
      <nav class="auth-links">
        <RouterLink to="/register">สมัครสมาชิก</RouterLink>
        <RouterLink to="/forgot-password">ลืมรหัสผ่าน</RouterLink>
      </nav>
    </section>
  </main>
</template>
