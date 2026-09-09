<!-- src/views/fundinfo/FundInfoDetailView.vue -->
<script setup>
// Orchestrator for the fund-detail page. Tabbed layout like the v3.2.1 HTML
// prototype, but tab state is a Vue `ref` and only the active panel is mounted
// (`v-if`, not `v-show`/innerHTML) — no idle Chart.js instances, no
// 0-size-canvas issue from initializing on a `display:none` element.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FUND_TYPES } from '../../data/fundinfoConstants'
import { isValidFundId } from '../../services/fundinfoApi'
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

// Theme is UI-preference only (light/dark, never PII) — owned by useFundinfoTheme.
const { isDark, toggleTheme } = useFundinfoTheme()

// ---------- Route param validation / access control ----------
// `route.params.id` is untrusted input, used only as a fundinfoStore lookup key
// (never in a path/query or reflected unescaped). Defense-in-depth — router/index.js's
// beforeEnter guard already rejects malformed ids before this view mounts.
const requestedId = computed(() => {
  const raw = route.params.id
  return isValidFundId(raw) ? raw : null
})

// ---------- Data (store-backed) ----------
// fundinfoStore delegates to fundinfoApi.js — this view doesn't change when
// VITE_FUNDINFO_API_MODE switches between direct/wordpress.
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
  // Guard: navigate only with a validated fund.type key, never raw route input.
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
// Reset to the first tab on fund change (mirrors the prototype's init()).
watch(() => fund.value?.id, () => { activeTab.value = 'overview' })

// ---------- Analytics wiring ----------
// Single source of truth for every derived number/string on this page.
const analytics = useFundAnalytics(fund)

// Daily NAV change, ported from the prototype (prevNav = second-to-last point
// of the 1Y series). `nav_change_pct_1d` looks broken upstream (e.g. +126% on
// an equity feeder — likely vs. inception NAV, not previous day), so diff the
// real nav-history series instead; apiNavHistoryVersion triggers the recompute.
const dailyChange = computed(() => {
  if (!fund.value) return { diffBaht: 0, diffPct: 0 }

  void analytics.apiNavHistoryVersion.value // reactivity trigger — see comment above
  const history = analytics.navHistory('1M')
  const nav = history?.isDaily ? history.navData : []
  const last = nav.length - 1
  if (last < 1) return { diffBaht: 0, diffPct: 0 } // Robustness: real series not loaded yet
  const prevNav = nav[last - 1]
  const diffBaht = nav[last] - prevNav
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
        <!-- Loading state: store fetch in flight (fundinfoStore -> fundinfoApi.js). -->
        <div v-if="isLoading" class="surf brd rounded-xl cs p-10 text-center max-w-lg mx-auto mt-10">
          <p class="text-base sub">กำลังโหลดข้อมูลกองทุน...</p>
        </div>

        <!-- Not-found state: unknown/invalid id, no data leaked, no route param reflected.
             Kept as a bordered card — a one-off alert/empty-state, distinct from --bg page content. -->
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
          <!-- Layout Fix: dropped surf/brd/rounded-xl so it sits directly on --bg instead
               of a separate white card; FundDetailHeader's own dividers keep the structure. -->
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

          <!-- Tab panel: only the active tab is mounted (v-if), so Chart.js canvases in
               the other panels never exist until selected. Layout Fix: dropped
               surf/brd/rounded-xl/cs (same as header) — tab bar's border-b keeps the divide. -->
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
