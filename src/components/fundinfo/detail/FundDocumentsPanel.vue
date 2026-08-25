<!-- src/components/fundinfo/detail/FundDocumentsPanel.vue -->
<script setup>
// Ported from "Panel 5: เอกสารเพิ่มเติม" (panel-documents) in the v3.2.1 HTML
// prototype. Purely presentational — alpha/beta/recovery are already-derived
// by useFundAnalytics(fundRef) and injected as props, same "presentation
// only" contract as FundFeesPanel.vue / FundDetailHeader.vue.
import { ref } from 'vue'

const props = defineProps({
  fund: { type: Object, required: true },
  accent: { type: String, required: true },
  // { alpha, beta, recover } — from useFundAnalytics(fundRef).alphaBetaRecover
  alphaBetaRecover: { type: Object, required: true },
  // Pre-formatted "X ปี Y เดือน" — from useFundAnalytics(fundRef).recoveringPeriodText
  recoveringPeriodText: { type: String, required: true },
})

// Auth/UX hardening: the prototype used a blocking window.alert() to fake a
// download. Replaced with a local, component-owned notice — alert()/confirm()
// are disruptive UX and a common vector for OS-level phishing-style dialog
// spoofing; this keeps the "simulate only, no real file" behavior without a
// native dialog or any external navigation/fetch call.
const downloadNotice = ref('')
let noticeTimer = null

function downloadDoc(label) {
  if (noticeTimer) clearTimeout(noticeTimer)
  // Anti-XSS: `label` is a fixed literal from the template below (never
  // derived from user/URL input), and is only ever bound via {{ }} text
  // interpolation — never v-html, never innerHTML.
  downloadNotice.value = `กำลังจำลองการดาวน์โหลดเอกสาร: ${label} ของกองทุน ${props.fund.id} (ระบบสาธิต — ไม่มีการดาวน์โหลดไฟล์จริง)`
  noticeTimer = setTimeout(() => { downloadNotice.value = '' }, 4000)
}

function isFiniteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

// API Compatibility — direct mode does not publish alpha/beta/recovery yet.
// Render a neutral placeholder instead of calling numeric methods on null.
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
