<!-- src/views/fundinfo/FundInfoDetailView.vue -->
<script setup>
// Orchestrator for the fund-detail page.
//
// IMPORTANT: reverses the earlier "no tab-switch" spec — target design
// (confirmed by screenshot) IS a tabbed layout, matching the v3.2.1 HTML
// prototype's visual structure. The difference from the prototype is HOW
// the tabs work: the prototype toggled `.hidden` via raw DOM classList
// (`switchTab()` walking `document.getElementById(...)`) and rebuilt panel
// markup with `innerHTML` template literals — both avoided here. Tab state
// is a plain Vue `ref`; only the active panel is mounted at all (`v-if`,
// not `v-show`), so inactive panels don't hold live Chart.js instances or
// unnecessary DOM in memory, and each panel's own onMounted chart-render
// logic (already in FundOverviewPanel/FundPerformancePanel/etc.) fires
// against a fully visible canvas every time — no 0-size-canvas issue from
// initializing Chart.js on a `display:none` element.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FUND_TYPES } from '../../data/fundinfoData'
import { isValidFundId, fundinfoApiMode } from '../../services/fundinfoApi'
import { useFundinfoStore } from '../../stores/fundinfoStore'
import { useFundinfoTheme } from '../../composables/useFundinfoTheme'
import { useFundAnalytics } from '../../composables/useFundAnalytics'

import FundDetailHeader from '../../components/fundinfo/detail/FundDetailHeader.vue'
import FundOverviewPanel from '../../components/fundinfo/detail/FundOverviewPanel.vue'
import FundPerformancePanel from '../../components/fundinfo/detail/FundPerformancePanel.vue'
import FundPortfolioPanel from '../../components/fundinfo/detail/FundPortfolioPanel.vue'
import FundFeesPanel from '../../components/fundinfo/detail/FundFeesPanel.vue'
import FundDocumentsPanel from '../../components/fundinfo/detail/FundDocumentsPanel.vue'

const route = useRoute()
const router = useRouter()

// Theme state is UI-preference only (light/dark), never sensitive/PII, and
// is owned entirely by useFundinfoTheme (out of scope for this file).
const { isDark, toggleTheme } = useFundinfoTheme()

// ---------- Route param validation / access control ----------
// Public, read-only page — no PII, no mutation, no auth token involved.
// `route.params.id` is untrusted input: never used to build a path/query,
// never reflected anywhere unescaped, only ever used as a fundinfoStore lookup
// key. The router's own beforeEnter guard (router/index.js) already rejects
// malformed ids before this view mounts — this is defense-in-depth in case
// the component is ever reached another way (e.g. programmatic push).
const requestedId = computed(() => {
  const raw = route.params.id
  return isValidFundId(raw) ? raw : null
})

// ---------- Data (store-backed — ready for the API-mode switch) ----------
// fundinfoStore delegates to fundinfoApi.js, which today reads the local
// mock/CSV dataset and later (VITE_FUNDINFO_API_MODE) calls the real backend
// — this view never needs to change when that switch flips.
const fundinfoStore = useFundinfoStore()

watch(
  requestedId,
  (id) => {
    if (id) fundinfoStore.loadFundById(id)
  },
  { immediate: true },
)

const fund = computed(() => (requestedId.value ? fundinfoStore.getFundById(requestedId.value) : undefined))
const isLoading = computed(() => (requestedId.value ? fundinfoStore.isLoading(requestedId.value) : false))
const typeMeta = computed(() => (fund.value ? FUND_TYPES[fund.value.type] : null))
const accent = computed(() => typeMeta.value?.accent || '#2456d8')

function goBack() {
  // Guard: only navigate using an already-validated, known fund.type key
  // (one of FUND_TYPES' own keys) — never using unvalidated route input.
  if (fund.value && FUND_TYPES[fund.value.type]) {
    router.push({ name: `fundinfo-${fund.value.type}` })
  } else {
    router.push({ name: 'fundinfo-feeder' })
  }
}

// ---------- Tabs ----------
const TABS = [
  { key: 'overview', label: 'กราฟภาพรวม' },
  { key: 'performance', label: 'ผลการดำเนินงานและปันผล' },
  { key: 'portfolio', label: 'สัดส่วนการลงทุน' },
  { key: 'fees', label: 'ค่าธรรมเนียม' },
  { key: 'documents', label: 'เอกสารเพิ่มเติม' },
]
const activeTab = ref('overview')
// Reset to the first tab whenever the user navigates to a different fund
// (mirrors the prototype's own init() calling switchTab('overview')).
watch(() => fund.value?.id, () => { activeTab.value = 'overview' })

// ---------- Analytics wiring ----------
// Single source of truth for every derived number/string on this page.
const analytics = useFundAnalytics(fund)

// Daily NAV change (diffBaht / diffPct), ported 1:1 from the prototype's
// init() (prevNav = second-to-last point of the 1Y series).
//
// API Data Quality — the fund profile's own `nav_change_pct_1d` looks broken
// upstream (e.g. +126.72% "1-day" change on an equity feeder, +19.99% on a
// low-volatility bond fund — consistent with being computed against
// inception NAV rather than the previous day). Don't surface it; diff the
// real daily nav-history series instead (analytics.apiNavHistoryVersion is
// read here so this recomputes once that async fetch resolves).
const dailyChange = computed(() => {
  if (!fund.value) return { diffBaht: 0, diffPct: 0 }

  if (fundinfoApiMode !== 'mock') {
    void analytics.apiNavHistoryVersion.value // reactivity trigger — see comment above
    const history = analytics.navHistory('1M')
    const nav = history?.isDaily ? history.navData : []
    const last = nav.length - 1
    if (last < 1) return { diffBaht: 0, diffPct: 0 } // Robustness: real series not loaded yet
    const prevNav = nav[last - 1]
    const diffBaht = nav[last] - prevNav
    return { diffBaht, diffPct: prevNav ? (diffBaht / prevNav) * 100 : 0 }
  }

  const nav = analytics.navHistory('1Y')?.navData || []
  const last = nav.length - 1
  if (last < 1) return { diffBaht: 0, diffPct: 0 } // Robustness: not enough points yet
  const prevNav = nav[last - 1] || fund.value.nav
  const diffBaht = fund.value.nav - prevNav
  return { diffBaht, diffPct: prevNav ? (diffBaht / prevNav) * 100 : 0 }
})
</script>

<template>
  <div class="fundinfo-scope min-h-screen" :class="{ dark: isDark }">
    <div class="min-h-screen" style="background: var(--bg); color: var(--txt)">
      <!-- Sticky top bar: back navigation + theme toggle -->
      <header class="surf border-b border-[var(--line)] cs sticky top-0 z-30">
        <!-- Layout Fix: dropped max-w-[1280px] mx-auto — that centered container was
             the "ขอบด้านข้าง" (side margins) on wide screens; w-full + small px keeps
             breathing room without capping content width. -->
        <div class="w-full px-4 flex items-center justify-between h-14">
          <div class="flex items-center gap-3 min-w-0">
            <button
              type="button"
              class="flex items-center gap-2 group text-sm font-bold txt hover:opacity-80 transition"
              @click="goBack"
            >
              <span class="text-base font-extrabold" aria-hidden="true">&lt;</span>
              <!-- Anti-XSS: typeMeta.label is app-owned static copy (FUND_TYPES), never user input -->
              <span class="hover:underline truncate">{{ typeMeta ? typeMeta.label : 'Fundinfo' }}</span>
            </button>
            <span class="sub text-xs" aria-hidden="true">/</span>
            <span class="text-xs font-semibold sub truncate">ข้อมูลรายละเอียดกองทุน</span>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-full border border-[var(--line)] flex items-center justify-center text-sm hover:opacity-80 transition shrink-0"
            title="สลับโหมด"
            :aria-pressed="isDark"
            aria-label="สลับโหมดสว่าง/มืด"
            @click="toggleTheme"
          >
            {{ isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </header>

      <main class="w-full px-4 md:px-8 py-6">
        <!-- Loading state: store fetch in flight (relevant once the API-mode
             switch flips to a real network call; resolves near-instantly in mock mode). -->
        <div v-if="isLoading" class="surf brd rounded-xl cs p-10 text-center max-w-lg mx-auto mt-10">
          <p class="text-base sub">กำลังโหลดข้อมูลกองทุน...</p>
        </div>

        <!-- Not-found state: unknown/invalid id, no data leaked, no route param reflected.
             Kept as a bordered card intentionally — this is a one-off alert/empty-state,
             not page content, so it stays visually distinct from --bg. Say the word if
             you want this flattened too. -->
        <div v-else-if="!fund" class="surf brd rounded-xl cs p-10 text-center max-w-lg mx-auto mt-10">
          <div class="text-5xl mb-4" aria-hidden="true">⚠️</div>
          <h2 class="text-xl font-bold txt mb-2">ไม่พบข้อมูลกองทุน</h2>
          <p class="text-base sub mb-6">ขออภัย ไม่พบกองทุนที่คุณร้องขอในฐานข้อมูลของเรา</p>
          <button
            type="button"
            class="px-5 py-2.5 text-white rounded-lg text-base font-bold transition hover:opacity-90"
            :style="{ background: accent }"
            @click="goBack"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>

        <div v-else class="flex flex-col gap-6">
          <!-- Fund summary header (always visible above the tabs) -->
          <!-- Layout Fix: dropped surf (white card bg) + brd (border) + rounded-xl —
               header now sits directly on --bg, blending into the page instead of
               popping as a separate white card. Internal section dividers inside
               FundDetailHeader.vue (border-b/border-l) already provide the visual
               structure, so nothing else needs to change. -->
          <div class="p-5 md:p-6">
            <FundDetailHeader
              :fund="fund"
              :type-meta="typeMeta"
              :accent="accent"
              :is-dark="isDark"
              :daily-change="dailyChange"
              :registration-date="analytics.registrationDate.value"
              :turnover-ratio="analytics.turnoverRatio.value"
              :bid-price="analytics.feeSchedule.value.bid"
              :offer-price="analytics.feeSchedule.value.offer"
              :policy-bullets="analytics.policyBullets.value"
            />
          </div>

          <!-- Tab bar -->
          <div role="tablist" aria-label="รายละเอียดกองทุน" class="flex border-b border-[var(--line)] gap-6 text-sm md:text-base font-bold overflow-x-auto whitespace-nowrap">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              type="button"
              role="tab"
              :id="`tab-${tab.key}`"
              :aria-selected="activeTab === tab.key"
              :aria-controls="`panel-${tab.key}`"
              class="pb-3 border-b-2 transition shrink-0"
              :class="activeTab === tab.key ? 'border-current' : 'border-transparent sub hover:opacity-80'"
              :style="activeTab === tab.key ? { color: accent } : {}"
              @click="activeTab = tab.key"
            >{{ tab.label }}</button>
          </div>

          <!-- Tab panel: only the active tab is mounted (v-if), so Chart.js
               canvases in the other 4 panels never exist until selected.
               Layout Fix: dropped surf (white/dark card bg) + brd (border) + rounded-xl + cs
               (box-shadow) — same treatment as the header above. Panel content now sits
               directly on --bg instead of floating as a separate card under the tab bar.
               The tab bar's own border-b already separates it from panel content, so no
               structural cue is lost. -->
          <div class="p-5 md:p-6">
            <div v-if="activeTab === 'overview'" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
              <FundOverviewPanel
                :fund="fund"
                :accent="accent"
                :is-dark="isDark"
                :nav-history="analytics.navHistory"
                :nav-history-version="analytics.apiNavHistoryVersion.value"
              />
            </div>

            <div v-else-if="activeTab === 'performance'" id="panel-performance" role="tabpanel" aria-labelledby="tab-performance">
              <FundPerformancePanel
                :fund="fund"
                :is-dark="isDark"
                :group-average="analytics.groupAverage"
                :dividend-history="analytics.dividendHistory.value"
              />
            </div>

            <div v-else-if="activeTab === 'portfolio'" id="panel-portfolio" role="tabpanel" aria-labelledby="tab-portfolio">
              <FundPortfolioPanel
                :fund="fund"
                :is-dark="isDark"
                :country-allocation="analytics.countryAllocation.value"
                :top-holdings="analytics.topHoldings.value"
              />
            </div>

            <div v-else-if="activeTab === 'fees'" id="panel-fees" role="tabpanel" aria-labelledby="tab-fees">
              <FundFeesPanel :fund="fund" :accent="accent" :is-dark="isDark" :fee-schedule="analytics.feeSchedule.value" />
            </div>

            <div v-else-if="activeTab === 'documents'" id="panel-documents" role="tabpanel" aria-labelledby="tab-documents">
              <FundDocumentsPanel
                :fund="fund"
                :accent="accent"
                :is-dark="isDark"
                :alpha-beta-recover="analytics.alphaBetaRecover.value"
                :recovering-period-text="analytics.recoveringPeriodText.value"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
