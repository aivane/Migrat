<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  username: '',
  email: '',
  password: '',
})

const message = ref('')

async function submitRegister() {
  message.value = ''

  try {
    await authStore.registerAccount(form)
    message.value = 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ'
    setTimeout(() => router.push('/login'), 800)
  } catch {
    message.value = authStore.error
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <p class="eyebrow">Account</p>
      <h1>สมัครสมาชิก</h1>
      <form class="auth-form" @submit.prevent="submitRegister">
        <label>
          Username
          <input v-model="form.username" autocomplete="username" required />
        </label>
        <label>
          Email
          <input v-model="form.email" type="email" autocomplete="email" required />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="new-password" required />
        </label>
        <button type="submit" :disabled="authStore.loading">
          {{ authStore.loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก' }}
        </button>
        <p v-if="message" class="auth-message">{{ message }}</p>
      </form>
      <nav class="auth-links">
        <RouterLink to="/login">มีบัญชีแล้ว</RouterLink>
      </nav>
    </section>
  </main>
</template>
