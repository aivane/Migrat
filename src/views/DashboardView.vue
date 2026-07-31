<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useDashboardStore } from '../stores/dashboardStore'

const dashboardStore = useDashboardStore()

const state = reactive({
  activeType: 'FOREIGN',
  sortBy: 'aum',
  sortDir: 'desc',
  searchInput: '',
  searchMode: false,
  searchFunds: [],
  page: 1,
  perPage: 10,
  selectedAmc: '',
  selectedFundType: '',
  selectedSector: '',
  selectedRisk: '',
  minReturn: '',
  stats: {
    FOREIGN: null,
    TH: null,
  },
  topStocks: {
    FOREIGN: [],
    TH: [],
  },
  funds: {
    FOREIGN: [],
    TH: [],
  },
  totals: {
    FOREIGN: 0,
    TH: 0,
  },
  masterEtfs: [],
  thaiEtfs: [],
  portfolioAllocation: null,
  loadedAt: null,
  partialErrors: {},
})

const loading = reactive({
  page: true,
  funds: true,
  search: false,
})

const errorMessage = ref('')
const cacheMessage = computed(() => {
  if (!dashboardStore.loadedAtLabel) return ''
  const source = dashboardStore.restoredFromSession ? 'จาก session cache' : 'ในหน้านี้'
  return `ข้อมูล${source} ถูก cache ไว้ล่าสุด ${dashboardStore.loadedAtLabel}`
})
const partialErrorMessage = computed(() => {
  if (!dashboardStore.hasPartialErrors) return ''
  return `โหลดข้อมูลได้บางส่วน (${dashboardStore.partialErrorList.length} endpoint มีปัญหา) ข้อมูลที่โหลดสำเร็จยังแสดงได้ตามปกติ`
})

const typeLabel = {
  FOREIGN: 'กองทุนต่างประเทศ',
  TH: 'กองทุนไทย',
}

const activeFunds = computed(() => {
  const source = state.searchMode ? state.searchFunds : state.funds[state.activeType]

  let rows = source.filter((fund) => fund.target_type === state.activeType)

  if (state.selectedAmc) rows = rows.filter((fund) => fund.amc === state.selectedAmc)
  if (state.selectedFundType) rows = rows.filter((fund) => fund.fund_type === state.selectedFundType)
  if (state.selectedSector) rows = rows.filter((fund) => fund.sector === state.selectedSector)
  if (state.selectedRisk) {
    rows = rows.filter((fund) => {
      if (state.selectedRisk === 'low') return fund.risk <= 3
      if (state.selectedRisk === 'medium') return fund.risk >= 4 && fund.risk <= 5
      return fund.risk >= 6
    })
  }
  if (state.minReturn !== '') {
    rows = rows.filter((fund) => fund.ret >= Number(state.minReturn))
  }

  return rows.sort((a, b) => {
    const left = Number(a[state.sortBy] || 0)
    const right = Number(b[state.sortBy] || 0)
    return (left - right) * (state.sortDir === 'desc' ? -1 : 1)
  })
})

const pagedFunds = computed(() => {
  const start = (state.page - 1) * state.perPage
  return activeFunds.value.slice(start, start + state.perPage)
})

const totalPages = computed(() => Math.max(1, Math.ceil(activeFunds.value.length / state.perPage)))

const filterOptions = computed(() => {
  const rows = state.searchMode ? state.searchFunds : [...state.funds.FOREIGN, ...state.funds.TH]

  return {
    amcs: unique(rows.map((fund) => fund.amc)),
    fundTypes: unique(rows.map((fund) => fund.fund_type)),
    sectors: unique(rows.map((fund) => fund.sector)),
  }
})

const activeStats = computed(() => normalizeStats(state.stats[state.activeType]))
const activeTopStocks = computed(() => state.topStocks[state.activeType] || [])
const hasVisibleFunds = computed(() => state.funds.FOREIGN.length || state.funds.TH.length)

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function normalizeStats(stats) {
  const cards = stats?.cards || stats?.data?.cards || {}
  const charts = stats?.charts || stats?.data?.charts || {}

  return {
    cards,
    charts,
    topSector: cards.top_sector || null,
    topFlowFund: cards.top_inflow_fund || cards.top_incoming_fund_1m || null,
    sectorAllocation: Array.isArray(charts.sector_allocation) ? charts.sector_allocation.slice(0, 8) : [],
    countryAllocation: Array.isArray(charts.country_allocation) ? charts.country_allocation.slice(0, 8) : [],
  }
}

function formatCompact(value) {
  const number = Number(value || 0)
  const abs = Math.abs(number)
  if (abs >= 1e12) return `${(number / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(number / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(number / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(number / 1e3).toFixed(0)}K`
  return number.toFixed(0)
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatPercent(value) {
  const number = Number(value || 0)
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

function riskClass(risk) {
  if (risk <= 3) return 'risk-low'
  if (risk <= 5) return 'risk-medium'
  return 'risk-high'
}

function methodClass(method) {
  if (method === 'Direct') return 'method-direct'
  if (method === 'Feeder Fund') return 'method-feeder'
  return 'method-other'
}

function barRows(items) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return items.map((item) => ({
    name: item.name || item.symbol || '-',
    value: total ? (Number(item.value || 0) / total) * 100 : 0,
  }))
}

function topStockRows(items) {
  const total = items.reduce((sum, item) => sum + Number(item.total_thai_fund_value || 0), 0)
  return items.slice(0, 8).map((item) => ({
    name: item.symbol || item.name || '-',
    value: total ? (Number(item.total_thai_fund_value || 0) / total) * 100 : 0,
  }))
}

function resetPaging() {
  state.page = 1
}

function setType(type) {
  state.activeType = type
  resetPaging()
}

function setSort(sortBy) {
  if (state.sortBy === sortBy) {
    state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc'
  } else {
    state.sortBy = sortBy
    state.sortDir = 'desc'
  }
}

async function loadInitialDashboard() {
  loading.page = true
  loading.funds = true
  errorMessage.value = ''

  try {
    applyDashboardSnapshot(await dashboardStore.loadDashboard())
  } catch (error) {
    errorMessage.value = 'ไม่สามารถดึงข้อมูล Dashboard ได้ กรุณาตรวจสอบ API/CORS หรือเปลี่ยน VITE_API_MODE เป็น wordpress'
    console.error(error)
  } finally {
    loading.page = false
    loading.funds = false
  }
}

async function runSearch() {
  const symbols = state.searchInput
    .split(/[,\s]+/)
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)

  if (!symbols.length) return

  loading.search = true
  errorMessage.value = ''

  try {
    state.searchFunds = await dashboardStore.searchBySymbols(symbols)
    state.searchMode = true
    resetPaging()
  } catch (error) {
    errorMessage.value = 'ค้นหากองทุนไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.search = false
  }
}

function clearSearch() {
  state.searchInput = ''
  state.searchMode = false
  state.searchFunds = []
  resetPaging()
}

async function refreshDashboard() {
  loading.page = true
  loading.funds = true
  errorMessage.value = ''

  try {
    applyDashboardSnapshot(await dashboardStore.loadDashboard({ force: true }))
    resetPaging()
  } catch (error) {
    errorMessage.value = 'รีเฟรชข้อมูล Dashboard ไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.page = false
    loading.funds = false
  }
}

function applyDashboardSnapshot(snapshot) {
  state.portfolioAllocation = snapshot.portfolioAllocation
  state.stats.FOREIGN = snapshot.stats.FOREIGN
  state.stats.TH = snapshot.stats.TH
  state.topStocks.FOREIGN = snapshot.topStocks.FOREIGN
  state.topStocks.TH = snapshot.topStocks.TH
  state.masterEtfs = snapshot.masterEtfs
  state.thaiEtfs = snapshot.thaiEtfs
  state.funds.FOREIGN = snapshot.funds.FOREIGN
  state.funds.TH = snapshot.funds.TH
  state.totals.FOREIGN = snapshot.totals.FOREIGN
  state.totals.TH = snapshot.totals.TH
  state.loadedAt = snapshot.loadedAt
  state.partialErrors = snapshot.partialErrors || {}
}

onMounted(loadInitialDashboard)
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-header">
      <div>
        <p class="eyebrow">Fund Dashboard</p>
        <h1>ภาพรวมกองทุน</h1>
        <p v-if="cacheMessage" class="cache-note">{{ cacheMessage }}</p>
      </div>
      <div class="type-tabs" aria-label="Fund type">
        <button :class="{ active: state.activeType === 'FOREIGN' }" @click="setType('FOREIGN')">
          ต่างประเทศ
        </button>
        <button :class="{ active: state.activeType === 'TH' }" @click="setType('TH')">
          ไทย
        </button>
      </div>
      <button class="refresh-button" :disabled="loading.page" @click="refreshDashboard">
        {{ loading.page ? 'Refreshing...' : 'Refresh' }}
      </button>
    </section>

    <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>
    <p v-if="partialErrorMessage" class="warning">{{ partialErrorMessage }}</p>

    <section class="summary-grid">
      <article class="summary-panel">
        <div class="panel-title">
          <span>{{ typeLabel[state.activeType] }}</span>
          <strong>{{ formatNumber(state.totals[state.activeType]) }}</strong>
        </div>
        <div class="stat-grid">
          <div>
            <span>จำนวนกองทุน</span>
            <strong>{{ formatNumber(activeStats.cards.total_funds || state.totals[state.activeType]) }}</strong>
          </div>
          <div>
            <span>Top Sector</span>
            <strong>{{ activeStats.topSector?.name || '-' }}</strong>
          </div>
          <div>
            <span>Flow เข้าสูงสุด</span>
            <strong>{{ activeStats.topFlowFund?.code || '-' }}</strong>
          </div>
          <div>
            <span>Top Holding</span>
            <strong>{{ activeTopStocks[0]?.symbol || '-' }}</strong>
          </div>
        </div>
      </article>

      <article class="summary-panel">
        <div class="panel-title">
          <span>Sector Allocation</span>
        </div>
        <div v-if="activeStats.sectorAllocation.length" class="bar-list">
          <div v-for="row in barRows(activeStats.sectorAllocation)" :key="row.name" class="bar-row">
            <span>{{ row.name }}</span>
            <div><i :style="{ width: `${Math.max(row.value, 3)}%` }"></i></div>
            <strong>{{ row.value.toFixed(1) }}%</strong>
          </div>
        </div>
        <p v-else class="muted">กำลังรอข้อมูล sector</p>
      </article>

      <article class="summary-panel">
        <div class="panel-title">
          <span>Top Holdings</span>
        </div>
        <div v-if="activeTopStocks.length" class="bar-list">
          <div v-for="row in topStockRows(activeTopStocks)" :key="row.name" class="bar-row">
            <span>{{ row.name }}</span>
            <div><i :style="{ width: `${Math.max(row.value, 3)}%` }"></i></div>
            <strong>{{ row.value.toFixed(1) }}%</strong>
          </div>
        </div>
        <p v-else class="muted">กำลังรอข้อมูล holdings</p>
      </article>
    </section>

    <section class="tool-row">
      <form class="search-box" @submit.prevent="runSearch">
        <input v-model="state.searchInput" placeholder="ค้นด้วย symbol เช่น AAPL, NVDA" />
        <button type="submit" :disabled="loading.search">
          {{ loading.search ? 'Searching...' : 'Search' }}
        </button>
        <button v-if="state.searchMode" type="button" class="secondary" @click="clearSearch">
          Clear
        </button>
      </form>

      <div class="filters">
        <select v-model="state.selectedAmc" @change="resetPaging">
          <option value="">AMC ทั้งหมด</option>
          <option v-for="amc in filterOptions.amcs" :key="amc" :value="amc">{{ amc }}</option>
        </select>
        <select v-model="state.selectedFundType" @change="resetPaging">
          <option value="">ประเภททั้งหมด</option>
          <option v-for="type in filterOptions.fundTypes" :key="type" :value="type">{{ type }}</option>
        </select>
        <select v-model="state.selectedSector" @change="resetPaging">
          <option value="">Sector ทั้งหมด</option>
          <option v-for="sector in filterOptions.sectors" :key="sector" :value="sector">{{ sector }}</option>
        </select>
        <select v-model="state.selectedRisk" @change="resetPaging">
          <option value="">Risk ทั้งหมด</option>
          <option value="low">ต่ำ 1-3</option>
          <option value="medium">กลาง 4-5</option>
          <option value="high">สูง 6+</option>
        </select>
      </div>
    </section>

    <section class="table-section">
      <div class="table-head">
        <div>
          <h2>Fund List</h2>
          <p>{{ formatNumber(activeFunds.length) }} รายการที่แสดง</p>
        </div>
        <div class="pagination">
          <button :disabled="state.page <= 1" @click="state.page -= 1">Prev</button>
          <span>{{ state.page }} / {{ totalPages }}</span>
          <button :disabled="state.page >= totalPages" @click="state.page += 1">Next</button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="left" @click="setSort('name')">กองทุน</th>
              <th @click="setSort('aum')">AUM</th>
              <th @click="setSort('ret')">1Y Return</th>
              <th @click="setSort('nav')">NAV</th>
              <th>Risk</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading.funds && !hasVisibleFunds">
              <td colspan="6">กำลังโหลดข้อมูล...</td>
            </tr>
            <tr v-else-if="!pagedFunds.length">
              <td colspan="6">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td>
            </tr>
            <tr v-for="fund in pagedFunds" v-else :key="`${fund.target_type}-${fund.code}`">
              <td class="left">
                <strong>{{ fund.code || '-' }}</strong>
                <span>{{ fund.name || '-' }}</span>
              </td>
              <td>฿{{ formatCompact(fund.aum) }}</td>
              <td :class="{ positive: fund.ret >= 0, negative: fund.ret < 0 }">
                {{ formatPercent(fund.ret) }}
              </td>
              <td>{{ formatNumber(fund.nav) }}</td>
              <td><span class="badge" :class="riskClass(fund.risk)">{{ fund.risk || '-' }}</span></td>
              <td><span class="badge" :class="methodClass(fund.method)">{{ fund.method }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="extra-grid">
      <article>
        <h2>Master ETFs</h2>
        <p v-if="!state.masterEtfs.length" class="muted">ยังไม่มีข้อมูล</p>
        <ul v-else>
          <li v-for="item in state.masterEtfs.slice(0, 8)" :key="item.symbol || item.code || item.name">
            <span>{{ item.symbol || item.code || item.name }}</span>
            <strong>{{ formatCompact(item.flow || item.value || item.aum) }}</strong>
          </li>
        </ul>
      </article>
      <article>
        <h2>Thai ETFs</h2>
        <p v-if="!state.thaiEtfs.length" class="muted">ยังไม่มีข้อมูล</p>
        <ul v-else>
          <li v-for="item in state.thaiEtfs.slice(0, 8)" :key="item.symbol || item.code || item.name">
            <span>{{ item.symbol || item.code || item.name }}</span>
            <strong>{{ formatCompact(item.flow || item.value || item.aum) }}</strong>
          </li>
        </ul>
      </article>
      <article>
        <h2>Portfolio Allocation</h2>
        <pre>{{ JSON.stringify(state.portfolioAllocation || {}, null, 2) }}</pre>
      </article>
    </section>
  </main>
</template>
