<!-- src/components/common/LoadingIndicator.vue -->
<script setup>
// Distinguishes "still fetching" from "genuinely no data" — see ApiErrorBanner.vue
// for the equivalent split on the error side. Some fundinfo list/ranking fetches
// paginate through the full real backend dataset and can take tens of seconds;
// without this, an in-flight request and an empty result look identical.
defineProps({
  label: { type: String, default: 'กำลังโหลดข้อมูล...' },
})
</script>

<template>
  <div class="loading-indicator" role="status">
    <span class="loading-spinner" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </div>
</template>

<style scoped>
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  color: var(--sub, #64748b);
  font-size: 13px;
}
.loading-spinner {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, currentColor 25%, transparent);
  border-top-color: currentColor;
  animation: loading-spin 0.7s linear infinite;
}
@keyframes loading-spin {
  to { transform: rotate(360deg); }
}
</style>
