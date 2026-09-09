<!-- src/components/fundinfo/detail/FundDocumentsPanel.vue -->
<script setup>
// Purely presentational — alpha/beta/recovery are already derived by useFundAnalytics(fundRef)
// and injected as props, same contract as FundFeesPanel.vue / FundDetailHeader.vue.
import { ref } from 'vue'

const props = defineProps({
  fund: { type: Object, required: true },
  accent: { type: String, required: true },
  // { alpha, beta, recover } — from useFundAnalytics(fundRef).alphaBetaRecover
  alphaBetaRecover: { type: Object, required: true },
  // Pre-formatted "X ปี Y เดือน" — from useFundAnalytics(fundRef).recoveringPeriodText
  recoveringPeriodText: { type: String, required: true },
})

// Replaces the prototype's blocking window.alert() (disruptive, phishing-spoofable) with a
// local component-owned notice — keeps "simulate only, no real file" without a native dialog.
const downloadNotice = ref('')
let noticeTimer = null

function downloadDoc(label) {
  if (noticeTimer) clearTimeout(noticeTimer)
  // Anti-XSS: `label` is a fixed template literal (never user/URL input), bound via {{ }} only.
  downloadNotice.value = `กำลังจำลองการดาวน์โหลดเอกสาร: ${label} ของกองทุน ${props.fund.id} (ระบบสาธิต — ไม่มีการดาวน์โหลดไฟล์จริง)`
  noticeTimer = setTimeout(() => { downloadNotice.value = '' }, 4000)
}

function isFiniteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

// direct mode doesn't publish a recovery period; alpha/beta are null until the backend computes
// them — render a neutral placeholder instead of calling numeric methods on null.
function alphaText(value) {
  return isFiniteMetric(value) ? `${value > 0 ? '+' : ''}${value}%` : '—'
}

function betaText(value) {
  return isFiniteMetric(value) ? value.toFixed(2) : '—'
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="max-w-2xl mx-auto w-full mt-2">
      <div class="flex items-center justify-between border-b border-[var(--line)] pb-3.5 mb-4">
        <h3 class="text-base font-bold txt">ข้อมูลจากหนังสือชี้ชวน</h3>
        <button
          type="button"
          class="px-3 py-1.5 rounded surf2 hover:opacity-80 text-xs font-bold txt transition flex items-center gap-1.5"
          @click="downloadDoc('หนังสือชี้ชวนโครงการ (Prospectus)')"
        >
          <span>หนังสือชี้ชวน</span>
          <span class="text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm" :style="{ background: accent }">PDF</span>
        </button>
      </div>

      <!-- role="status": announces the mock-download confirmation to assistive tech without a blocking dialog -->
      <p v-if="downloadNotice" role="status" class="text-xs font-semibold txt surf2 rounded-lg px-3 py-2 mb-4">
        {{ downloadNotice }}
      </p>

      <div class="divide-y divide-[var(--line)] text-sm font-semibold">
        <div class="flex justify-between py-3.5">
          <span class="sub">Recovering Period</span>
          <span class="num txt">{{ recoveringPeriodText }}</span>
        </div>
        <div class="flex justify-between py-3.5">
          <span class="sub">Alpha</span>
          <span class="num" :class="alphaBetaRecover.alpha < 0 ? 'text-neg' : 'text-pos'">{{ alphaText(alphaBetaRecover.alpha) }}</span>
        </div>
        <div class="flex justify-between py-3.5">
          <span class="sub">Beta</span>
          <span class="num text-pos">{{ betaText(alphaBetaRecover.beta) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
