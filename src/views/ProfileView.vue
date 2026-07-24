<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const displayName = ref('')
const message = ref('')

onMounted(async () => {
  authStore.restore()

  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  try {
    await authStore.loadProfile()
    displayName.value = authStore.displayName
  } catch {
    message.value = authStore.error
  }
})

async function saveProfile() {
  message.value = ''

  try {
    await authStore.updateDisplayName(displayName.value)
    message.value = 'บันทึกข้อมูลแล้ว'
  } catch {
    message.value = authStore.error || 'บันทึกข้อมูลไม่สำเร็จ'
  }
}

async function logout() {
  await authStore.logoutUser()
  router.push('/login')
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel profile-panel">
      <div class="profile-head">
        <div>
          <p class="eyebrow">Account</p>
          <h1>โปรไฟล์</h1>
        </div>
        <button class="secondary-button" @click="logout">ออกจากระบบ</button>
      </div>

      <div v-if="authStore.account || authStore.user" class="profile-grid">
        <div>
          <span>Email</span>
          <strong>{{ authStore.account?.email || authStore.user?.email || '-' }}</strong>
        </div>
        <div>
          <span>Username</span>
          <strong>{{ authStore.user?.username || authStore.account?.username || '-' }}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{{ authStore.account?.status || 'Active' }}</strong>
        </div>
      </div>

      <form class="auth-form" @submit.prevent="saveProfile">
        <label>
          Display name
          <input v-model="displayName" />
        </label>
        <button type="submit" :disabled="authStore.loading">บันทึก</button>
        <p v-if="message" class="auth-message">{{ message }}</p>
      </form>

      <nav class="auth-links">
        <RouterLink to="/dashboard">Dashboard</RouterLink>
        <RouterLink to="/insights">Insights</RouterLink>
      </nav>
    </section>
  </main>
</template>
