<script setup>
import { nextTick, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FUND_TYPES } from '../../data/fundinfoData'
import { useFundinfoTheme } from '../../composables/useFundinfoTheme'
import { useFundinfoWatchlist } from '../../composables/useFundinfoWatchlist'

const tabs = [
  { to: '/fundinfo/feeder', ...FUND_TYPES.feeder },
  { to: '/fundinfo/offshore', ...FUND_TYPES.offshore },
  { to: '/fundinfo/thai', ...FUND_TYPES.thai },
  { to: '/fundinfo/mixed', ...FUND_TYPES.mixed },
]

const { isDark, toggleTheme } = useFundinfoTheme()
const { count, watchedFunds, removeWatch } = useFundinfoWatchlist()
const route = useRoute()
const router = useRouter()

const watchPanelOpen = ref(false)
const watchPanelRef = ref(null)
let focusTimer

const fundRouteByType = {
  feeder: 'fundinfo-feeder',
  offshore: 'fundinfo-offshore',
  thai: 'fundinfo-thai',
  mixed: 'fundinfo-mixed',
}

async function goToWatchedFund(fund) {
  const targetRoute = fundRouteByType[fund.type]
  if (!targetRoute) return

  watchPanelOpen.value = false
  if (route.name !== targetRoute) await router.push({ name: targetRoute })
  await nextTick()

  const row = document.getElementById(`fund-row-${fund.id}`)
  if (!row) return

  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  document.querySelectorAll('.fund-result-row.wishlist-focus').forEach((item) => item.classList.remove('wishlist-focus'))
  row.classList.add('wishlist-focus')
  window.clearTimeout(focusTimer)
  focusTimer = window.setTimeout(() => row.classList.remove('wishlist-focus'), 1800)
}

function handleOutsideClick(event) {
  if (watchPanelOpen.value && watchPanelRef.value && !watchPanelRef.value.contains(event.target)) {
    watchPanelOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))
</script>

<template>
  <div class="fundinfo-scope min-h-screen" :class="{ dark: isDark }">
    <main class="min-h-screen bg-[var(--bg)] text-[var(--txt)] font-['Prompt'] antialiased">

      <header class="sticky top-0 z-30 surf brdb px-4 py-2">
        <div class="max-w-[1120px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">

          <!-- Branding: FI mark + Fundinfo / Investment Exposure Workspace -->
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-md bg-[var(--brand)] text-white font-extrabold flex items-center justify-center text-[10px] shrink-0">FI</div>
            <div>
              <div class="text-sm font-extrabold txt leading-tight">Fundinfo</div>
              <div class="text-[8px] font-bold uppercase tracking-wider sub leading-tight">Investment Exposure Workspace</div>
            </div>
          </div>

          <div class="flex items-center gap-3 justify-between md:justify-end">
            <!-- Fund type tabs — fully-rounded pills, active tab = solid --brand -->
            <nav class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" aria-label="ประเภทกองทุน">
              <RouterLink
                v-for="tab in tabs"
                :key="tab.to"
                :to="tab.to"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap border border-transparent sub hover:surf2 hover:txt"
                active-class="!bg-[var(--brand)] !text-white !border-[var(--brand)] shadow-md shadow-blue-500/20"
              >
                <span class="text-sm">{{ tab.emoji }}</span>
                <span>{{ tab.label }}</span>
              </RouterLink>
            </nav>

            <div class="flex items-center gap-2 shrink-0">
              <!-- Watchlist -->
              <div class="relative" ref="watchPanelRef">
                <button
                  type="button"
                  class="watchlist-trigger surf brd h-10 min-w-10 px-2.5 rounded-lg font-bold flex items-center gap-1"
                  title="รายการติดตาม"
                  @click="watchPanelOpen = !watchPanelOpen"
                >
                  <span class="watchlist-icon" aria-hidden="true">★</span><span class="num text-[11px]">{{ count }}</span>
                </button>

                <div
                  v-if="watchPanelOpen"
                  class="absolute right-0 mt-2 w-72 surf brd rounded-xl z-50 overflow-hidden shadow-lg"
                >
                  <div class="px-3 py-2 brdb flex items-center justify-between">
                    <span class="text-xs font-bold txt">รายการติดตาม</span>
                    <span class="text-[11px] sub">{{ count }} กอง</span>
                  </div>
                  <div v-if="!watchedFunds.length" class="p-4 text-xs sub text-center">
                    ยังไม่มีกองทุนที่ติดตาม กด ☆ ที่ตารางกองทุนเพื่อเพิ่ม
                  </div>
                  <div v-else class="max-h-72 overflow-y-auto divide-y divide-[var(--line)]">
                    <div v-for="fund in watchedFunds" :key="fund.id" class="p-2.5 flex items-center justify-between hover:bg-[var(--surf2)]">
                      <button type="button" class="watchlist-item min-w-0 text-left" :title="`ไปยังกองทุน ${fund.name}`" @click="goToWatchedFund(fund)">
                        <strong class="num txt block truncate text-xs">{{ fund.id }}</strong>
                        <span class="sub text-[11px] truncate block">{{ fund.name }}</span>
                      </button>
                      <button
                        type="button"
                        class="text-[11px] font-bold sub hover:text-[var(--neg)] shrink-0 ml-2"
                        title="นำออกจากรายการติดตาม"
                        @click.stop="removeWatch(fund.id)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Dark mode toggle -->
              <button
                type="button"
                class="surf brd w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                title="สลับโหมด"
                @click="toggleTheme"
              >
                {{ isDark ? '☀️' : '🌙' }}
              </button>
            </div>
          </div>

        </div>
      </header>

      <div class="max-w-[1120px] mx-auto px-5 py-7 md:px-7 md:py-8">
        <RouterView />
      </div>

    </main>
  </div>
</template>
