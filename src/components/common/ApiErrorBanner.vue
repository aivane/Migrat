<!-- src/components/common/ApiErrorBanner.vue -->
<script setup>
// Surfaces a genuine API failure (network error, 5xx, timeout — see
// apiClient.js's ApiRequestError) distinctly from "no data yet" so it reads
// as a backend problem, not a blank/broken page. Previously these errors
// were captured in fundinfoStore.error[key] (loadError / stockRankingError
// etc.) but no component ever rendered them — they were silently dropped.
defineProps({
  message: { type: String, required: true },
})
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="api-error-banner" role="alert">
    <span class="api-error-banner-icon" aria-hidden="true">!</span>
    <div class="api-error-banner-body">
      <strong>ระบบข้อมูลฝั่ง backend มีปัญหา</strong>
      <p>{{ message }}</p>
    </div>
    <button type="button" class="api-error-banner-retry" @click="emit('retry')">ลองใหม่</button>
  </div>
</template>

<style scoped>
.api-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, #f04438 10%, var(--surf, #fff));
  border: 1px solid color-mix(in srgb, #f04438 35%, transparent);
  margin-bottom: 14px;
}
.api-error-banner-icon {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f04438;
  color: #fff;
  font: 800 12px/20px 'Prompt', sans-serif;
  text-align: center;
}
.api-error-banner-body {
  flex: 1;
  min-width: 0;
}
.api-error-banner-body strong {
  display: block;
  color: #f04438;
  font-size: 13px;
  font-weight: 800;
}
.api-error-banner-body p {
  margin: 2px 0 0;
  color: var(--txt, #1e293b);
  font-size: 12px;
  line-height: 1.5;
}
.api-error-banner-retry {
  flex: none;
  border: 1px solid color-mix(in srgb, #f04438 45%, transparent);
  border-radius: 8px;
  background: transparent;
  color: #f04438;
  font: 700 12px/1.2 'Prompt', sans-serif;
  padding: 6px 12px;
  cursor: pointer;
}
.api-error-banner-retry:hover {
  background: color-mix(in srgb, #f04438 12%, transparent);
}
</style>
