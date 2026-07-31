<script setup>
import { onMounted, reactive, ref } from 'vue'
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
const googleLoading = ref(false)

async function submitLogin() {
  message.value = ''

  try {
    await authStore.loginWithPassword(form)
    router.push('/profile')
  } catch {
    message.value = authStore.error
  }
}

// ===== Google Identity Services =====
onMounted(async () => {
  const clientId = await authStore.getGoogleClientId()
  if (!clientId) return

  // โหลด Google GIS script
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      callback: handleGoogleCredential,
    })

    window.google.accounts.id.renderButton(
      document.getElementById('google-btn-container'),
      {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'signin_with',
        size: 'large',
        logo_alignment: 'left',
        width: '100%',
      }
    )
  }
  document.head.appendChild(script)
})

async function handleGoogleCredential(response) {
  googleLoading.value = true
  message.value = ''

  try {
    await authStore.loginWithGoogle(response.credential)
    router.push('/profile')
  } catch {
    message.value = authStore.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
  } finally {
    googleLoading.value = false
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

      <!-- Divider -->
      <div class="auth-divider">
        <span>หรือ</span>
      </div>

      <!-- Google Login Button -->
      <div class="google-btn-wrapper">
        <div v-if="googleLoading" class="google-loading">
          <span class="spinner"></span>
          กำลังเข้าสู่ระบบด้วย Google...
        </div>
        <div id="google-btn-container"></div>
      </div>

      <nav class="auth-links">
        <RouterLink to="/register">สมัครสมาชิก</RouterLink>
        <RouterLink to="/forgot-password">ลืมรหัสผ่าน</RouterLink>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
  color: var(--color-text-muted, #888);
  font-size: 13px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border, #e0e0e0);
}

.google-btn-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
  min-height: 44px;
}

.google-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-muted, #666);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top-color: #4285f4;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>