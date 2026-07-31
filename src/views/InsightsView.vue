<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getThemeFundsRaw } from '../services/insightsApi'
import { useInsightsStore } from '../stores/insightsStore'

const insightsStore = useInsightsStore()

const state = reactive({
  tab: 'flow',
  period: '1M',
  trendFunds: [],
  valuationFunds: [],
  popularityFunds: [],
  themes: [],
  selectedThemes: [],
  globalFlows: [],
  globalFlowSummary: {},
  themeFunds: {},
  loadedAt: null,
  selectedFund: null,
  selectedFundTheme: '',
  selectedFlow: null,
  selectedFlowType: '',
  selectedFlowDetail: null,
  selectedFlowDetailError: '',
})

const loading = reactive({
  page: true,
  themes: false,
  flowDetail: false,
})

const errorMessage = ref('')

const cacheMessage = computed(() => {
  if (!insightsStore.loadedAtLabel) return ''
  const source = insightsStore.restoredFromSession ? 'จาก session cache' : 'ในหน้านี้'
  return `ข้อมูล${source} ถูก cache ไว้ล่าสุด ${insightsStore.loadedAtLabel}`
})

const partialErrorMessage = computed(() => {
  if (!insightsStore.hasPartialErrors) return ''
  return `โหลด Insights ได้บางส่วน (${insightsStore.partialErrorList.length} endpoint มีปัญหา) ข้อมูลที่สำเร็จยังแสดงได้ตามปกติ`
})

const tabs = [
  { key: 'flow', icon: '🌍', label: 'Global Fund Flow', desc: 'เงินไหลเข้า/ออก' },
  { key: 'trend', icon: '📈', label: 'Uptrend', desc: 'กองทุนขาขึ้น' },
  { key: 'valuation', icon: '💎', label: 'Valuation', desc: 'PE ถูกหรือแพง' },
]

const periods = ['1D', '1W', '1M', '3M', 'YTD']

const positiveFlows = computed(() =>
  state.globalFlows
    .filter((flow) => Number(flow.flow_usd || flow.value || 0) >= 0)
    .sort((a, b) => Number(b.flow_usd || b.value || 0) - Number(a.flow_usd || a.value || 0))
    .slice(0, 10),
)

const negativeFlows = computed(() =>
  state.globalFlows
    .filter((flow) => Number(flow.flow_usd || flow.value || 0) < 0)
    .sort((a, b) => Number(a.flow_usd || a.value || 0) - Number(b.flow_usd || b.value || 0))
    .slice(0, 10),
)

const maxFlow = computed(() => {
  const values = state.globalFlows.map((flow) => Math.abs(Number(flow.flow_usd || flow.value || 0)))
  return Math.max(...values, 1)
})

const selectedThemeGroups = computed(() => {
  if (!state.selectedThemes.length) return []

  return state.selectedThemes.map((theme) => ({
    name: themeLabel(theme),
    funds: getThemeFunds(theme),
  }))
})

function themeLabel(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (!value || typeof value !== 'object') return ''

  return (
    value.name ||
    value.theme ||
    value.label ||
    value.title ||
    value.category ||
    themeLabel(value.themes) ||
    ''
  )
}

function themeKey(value, prefix = 'theme') {
  return themeLabel(value) || `${prefix}-${JSON.stringify(value)}`
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

function formatPercent(value) {
  const number = Number(value || 0)
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

function flowValue(flow) {
  return Number(flow.flow_usd || flow.value || flow.flow || 0)
}

function flowWidth(flow) {
  return `${Math.max((Math.abs(flowValue(flow)) / maxFlow.value) * 100, 3)}%`
}

function flowDisplayValue(flow) {
  const value = flowValue(flow)
  return `${value >= 0 ? '+' : '-'}$${formatCompact(Math.abs(value))}`
}

function flowDetailRows(flow) {
  if (!flow || typeof flow !== 'object') return []

  return Object.entries(flow)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      value: formatDetailValue(value),
    }))
}

function flowTrendRows(detail) {
  if (!detail || typeof detail !== 'object') return []
  return flowDetailRows(detail?.data || detail)
}

function formatDetailValue(value) {
  if (Array.isArray(value)) return value.length ? value.map(formatDetailValue).join(', ') : '[]'
  if (value && typeof value === 'object' && !Object.keys(value).length) return '{}'
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-'
  return String(value)
}

function fundName(fund) {
  return fund.name_th || fund.name || fund.code || '-'
}

function returnValue(fund) {
  return fund.return_1y ?? fund.ret ?? fund.return ?? 0
}

function riskClass(risk) {
  const value = Number(risk || 0)
  if (value <= 3) return 'risk-low'
  if (value <= 5) return 'risk-medium'
  return 'risk-high'
}

function getThemeFunds(theme) {
  const name = themeLabel(theme)
  const source = state.themeFunds?.[name] || state.themeFunds?.themes?.[name] || state.themeFunds?.[name.toLowerCase()]
  const nestedSource =
    state.themeFunds?.theme_funds?.[name] ||
    state.themeFunds?.theme_funds?.[name.toLowerCase()] ||
    state.themeFunds?.data?.theme_funds?.[name]

  if (Array.isArray(source)) return source
  if (Array.isArray(source?.funds)) return source.funds
  if (Array.isArray(nestedSource)) return nestedSource
  if (Array.isArray(nestedSource?.funds)) return nestedSource.funds

  return []
}

function fundFlowSeries(fund) {
  const period = state.period
  const flows = fund?.flows || fund?.flow_series || fund?.flow_trend || {}

  if (Array.isArray(flows)) return flows
  if (Array.isArray(flows[period])) return flows[period]
  if (Array.isArray(flows[period?.toLowerCase?.()])) return flows[period.toLowerCase()]
  if (Array.isArray(fund?.[`flows_${period}`])) return fund[`flows_${period}`]

  return []
}

function flowPointValue(point) {
  return Number(point?.net ?? point?.net_flow ?? point?.flow ?? point?.value ?? 0)
}

function flowPointLabel(point) {
  const raw = String(point?.date || point?.year || point?.label || '')
  if (!raw) return '-'

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  const month = parsed.toLocaleString('en-US', { month: 'short' })
  if (state.period === '1D' || state.period === '1W' || state.period === '1M') {
    return `${month} ${parsed.getDate()}`
  }

  return `${month} ${parsed.getFullYear()}`
}

function flowBarHeight(point, series) {
  const max = Math.max(...series.map((item) => Math.abs(flowPointValue(item))), 1)
  return `${Math.max((Math.abs(flowPointValue(point)) / max) * 50, 3)}%`
}

function fundAum(fund) {
  return fund.aum ?? fund.total_aum ?? fund.asset_size ?? 0
}

function fundNav(fund) {
  return fund.nav ?? fund.latest_nav ?? fund.price ?? 0
}

function openFundModal(fund, themeName) {
  state.selectedFund = fund
  state.selectedFundTheme = themeName
}

function closeFundModal() {
  state.selectedFund = null
  state.selectedFundTheme = ''
}

function loadedThemeDetail(flow) {
  const name = themeLabel(flow)
  return (
    state.themeFunds?.[name] ||
    state.themeFunds?.theme_funds?.[name] ||
    state.themeFunds?.data?.theme_funds?.[name] ||
    null
  )
}

function openFlowModal(flow, type) {
  state.selectedFlow = flow
  state.selectedFlowType = type
  state.selectedFlowDetail = loadedThemeDetail(flow)
  state.selectedFlowDetailError = ''
}

async function fetchFlowDetailApi() {
  if (!state.selectedFlow) return

  loading.flowDetail = true
  state.selectedFlowDetailError = ''

  try {
    const themeName = themeLabel(state.selectedFlow)
    state.selectedFlowDetail = await getThemeFundsRaw([themeName], 10, { period: state.period })
  } catch (error) {
    state.selectedFlowDetailError = error?.message || 'โหลดรายละเอียดจาก API ไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.flowDetail = false
  }
}

function closeFlowModal() {
  state.selectedFlow = null
  state.selectedFlowType = ''
  state.selectedFlowDetail = null
  state.selectedFlowDetailError = ''
}

async function loadInsights(force = false) {
  loading.page = true
  errorMessage.value = ''

  try {
    applySnapshot(await insightsStore.loadInsights({ force, period: state.period }))
  } catch (error) {
    errorMessage.value = 'ไม่สามารถดึงข้อมูล Insights ได้'
    console.error(error)
  } finally {
    loading.page = false
  }
}

async function changePeriod(period) {
  state.period = period
  loading.page = true
  errorMessage.value = ''

  try {
    applySnapshot(await insightsStore.setPeriod(period))
  } catch (error) {
    errorMessage.value = 'เปลี่ยนช่วงเวลาไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.page = false
  }
}

async function toggleTheme(themeName) {
  loading.themes = true
  errorMessage.value = ''

  try {
    applySnapshot(await insightsStore.toggleTheme(themeName))
  } catch (error) {
    errorMessage.value = 'โหลดกองทุนตามธีมไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.themes = false
  }
}

function clearThemes() {
  insightsStore.clearThemes()
  applySnapshot(insightsStore.snapshot())
}

function applySnapshot(snapshot) {
  state.period = snapshot.period || '1M'
  state.trendFunds = snapshot.trendFunds || []
  state.valuationFunds = snapshot.valuationFunds || []
  state.popularityFunds = snapshot.popularityFunds || []
  state.themes = snapshot.themes || []
  state.selectedThemes = snapshot.selectedThemes || []
  state.globalFlows = snapshot.globalFlows || []
  state.globalFlowSummary = snapshot.globalFlowSummary || {}
  state.themeFunds = snapshot.themeFunds || {}
  state.loadedAt = snapshot.loadedAt
}

onMounted(() => loadInsights(false))
</script>

<template>
  <main id="fi-app" class="insights-page fi-app-vue">
    <section class="fi-hdr">
      <div class="fi-hdr-inner">
        <div class="fi-title-row">
          <span class="fi-title-icon">🧭</span>
          <h1>Fund Insights</h1>
          <button class="fi-refresh" :disabled="loading.page" @click="loadInsights(true)">
            {{ loading.page ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
        <p class="fi-sub">วิเคราะห์โอกาสลงทุนผ่านกองทุนรวมไทย</p>
        <p v-if="cacheMessage" class="fi-cache-note">{{ cacheMessage }}</p>

        <div class="fi-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="fi-tab"
            :class="{ on: state.tab === tab.key }"
            @click="state.tab = tab.key"
          >
            <span class="fi-tab-icon">{{ tab.icon }}</span>
            <span class="fi-tab-text">
              <span class="fi-tab-label">{{ tab.label }}</span>
              <span class="fi-tab-desc">{{ tab.desc }}</span>
            </span>
          </button>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>
    <p v-if="partialErrorMessage" class="warning">{{ partialErrorMessage }}</p>

    <section v-if="state.tab === 'flow'" class="fi-flow-view">
      <div class="gf-title-row">
        <div class="gf-title">
          <span>📊</span>
          <h3>Global Equity Fund Flow</h3>
        </div>
        <div class="gf-period-btns">
          <button
            v-for="period in periods"
            :key="period"
            class="gf-period-btn"
            :class="{ on: state.period === period }"
            @click="changePeriod(period)"
          >
            {{ period }}
          </button>
        </div>
      </div>

      <div class="gf-summary-wrap">
        <div class="gf-summary">
          <div class="gf-summary-card">
            <div class="gf-summary-label">NET FLOW</div>
            <div class="gf-summary-value" :class="{ negative: Number(state.globalFlowSummary.net_flow_usd || 0) < 0 }">
              {{ Number(state.globalFlowSummary.net_flow_usd || 0) >= 0 ? '+' : '-' }}${{
                formatCompact(Math.abs(Number(state.globalFlowSummary.net_flow_usd || 0)))
              }}
            </div>
          </div>
          <div class="gf-summary-card">
            <div class="gf-summary-label">INFLOW</div>
            <div class="gf-summary-value positive">+${{ formatCompact(state.globalFlowSummary.total_inflow_usd || 0) }}</div>
          </div>
          <div class="gf-summary-card">
            <div class="gf-summary-label">OUTFLOW</div>
            <div class="gf-summary-value negative">-${{ formatCompact(Math.abs(state.globalFlowSummary.total_outflow_usd || 0)) }}</div>
          </div>
          <div class="gf-summary-card">
            <div class="gf-summary-label">INFLOW ธีม</div>
            <div class="gf-summary-value positive">{{ state.globalFlowSummary.inflow_themes || positiveFlows.length }}</div>
          </div>
          <div class="gf-summary-card">
            <div class="gf-summary-label">OUTFLOW ธีม</div>
            <div class="gf-summary-value negative">{{ state.globalFlowSummary.outflow_themes || negativeFlows.length }}</div>
          </div>
        </div>
      </div>

      <div class="gf-flow-section">
        <div class="gf-flow-header">
          <div class="gf-flow-title">Fund Flow รายธีม</div>
        </div>
        <div class="gf-flow-cols">
          <div v-if="positiveFlows.length" class="gf-flow-col">
            <div
              v-for="flow in positiveFlows"
              :key="themeKey(flow, 'inflow')"
              :class="{ selected: state.selectedThemes.includes(themeLabel(flow)) }"
              class="gf-flow-row"
            >
              <button class="gf-flow-detail-btn" aria-label="ดูรายละเอียด" @click="openFlowModal(flow, 'Inflow')">+</button>
              <button class="gf-flow-main" @click="toggleTheme(themeLabel(flow))">
                <span class="gf-flow-name">{{ themeLabel(flow) || '-' }}</span>
                <span class="gf-flow-bar-wrap">
                  <i class="gf-flow-bar inflow" :style="{ width: flowWidth(flow) }"></i>
                </span>
                <strong class="gf-flow-amount positive">+${{ formatCompact(flowValue(flow)) }}</strong>
              </button>
            </div>
          </div>
          <p v-else class="muted">ยังไม่มีข้อมูล inflow</p>

          <div v-if="negativeFlows.length" class="gf-flow-col">
            <div
              v-for="flow in negativeFlows"
              :key="themeKey(flow, 'outflow')"
              :class="{ selected: state.selectedThemes.includes(themeLabel(flow)) }"
              class="gf-flow-row"
            >
              <button class="gf-flow-detail-btn" aria-label="ดูรายละเอียด" @click="openFlowModal(flow, 'Outflow')">+</button>
              <button class="gf-flow-main" @click="toggleTheme(themeLabel(flow))">
                <span class="gf-flow-name">{{ themeLabel(flow) || '-' }}</span>
                <span class="gf-flow-bar-wrap out">
                  <i class="gf-flow-bar outflow" :style="{ width: flowWidth(flow) }"></i>
                </span>
                <strong class="gf-flow-amount negative">-${{ formatCompact(Math.abs(flowValue(flow))) }}</strong>
              </button>
            </div>
          </div>
          <p v-else class="muted">ยังไม่มีข้อมูล outflow</p>
        </div>
      </div>

      <div class="gf-thai-section">
        <div class="gf-thai-header">
          <h3>Theme Funds</h3>
          <button v-if="state.selectedThemes.length" class="gf-tag-clear" @click="clearThemes">ยกเลิกทั้งหมด ✕</button>
        </div>
        <div class="gf-thai-tags">
          <button
            v-for="theme in state.themes"
            :key="themeKey(theme)"
            class="gf-tag"
            :class="{ on: state.selectedThemes.includes(themeLabel(theme)) }"
            @click="toggleTheme(themeLabel(theme))"
          >
            {{ themeLabel(theme) || '-' }} <span v-if="state.selectedThemes.includes(themeLabel(theme))" class="gf-tag-x">✕</span>
          </button>
        </div>
        <p v-if="loading.themes" class="muted">กำลังโหลดกองทุนตามธีม...</p>
        <div v-if="selectedThemeGroups.length" class="theme-groups">
          <article v-for="group in selectedThemeGroups" :key="group.name" class="gf-theme-group">
            <h3 class="gf-theme-group-title">{{ group.name }}</h3>
            <div v-if="group.funds.length" class="gf-fund-cards">
              <button
                v-for="(fund, index) in group.funds.slice(0, 10)"
                :key="fund.code || fund.name"
                class="gf-fund-card"
                @click="openFundModal(fund, group.name)"
              >
                <span class="gf-fund-rank">#{{ fund.rank || index + 1 }}</span>
                <strong class="gf-fund-code">{{ fund.code || '-' }}</strong>
                <span class="gf-fund-amc">{{ fund.amc || '-' }}</span>
                <span class="gf-fund-name">{{ fundName(fund) }}</span>
                <div class="gf-fund-metrics">
                  <span>
                    <small>1Y</small>
                    <em class="gf-fund-ret" :class="{ negative: returnValue(fund) < 0 }">{{ formatPercent(returnValue(fund)) }}</em>
                  </span>
                  <span>
                    <small>Risk</small>
                    <strong>{{ fund.risk || '-' }}</strong>
                  </span>
                </div>
                <div v-if="fundFlowSeries(fund).length" class="gf-mini-flow-chart compact">
                  <div
                    v-for="point in fundFlowSeries(fund)"
                    :key="`${fund.code || fund.name}-${point.date || point.year || point.label}`"
                    class="gf-mini-flow-point"
                  >
                    <i
                      :class="{ positive: flowPointValue(point) >= 0, negative: flowPointValue(point) < 0 }"
                      :style="{ height: flowBarHeight(point, fundFlowSeries(fund)) }"
                    ></i>
                    <span>{{ flowPointLabel(point) }}</span>
                  </div>
                </div>
                <p v-else class="muted">ไม่มีข้อมูล Inflow / Outflow</p>
              </button>
            </div>
            <p v-else class="muted">ยังไม่มีข้อมูลกองทุนในธีมนี้</p>
          </article>
        </div>
      </div>
    </section>

    <section v-if="state.tab === 'trend'" class="fi-body">
      <div class="fi-section-hdr">
        <div>
          <h3>📈 Uptrend — กองทุนขาขึ้น</h3>
          <p>ดึงข้อมูลจาก API /insights/trend</p>
        </div>
      </div>
      <div class="fi-tbl-wrap">
        <table class="fi-tbl">
          <thead>
            <tr>
              <th class="l">กองทุน</th>
              <th class="c">1Y Return</th>
              <th class="c">Risk</th>
              <th class="c">AMC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading.page && !state.trendFunds.length">
              <td colspan="4">กำลังโหลดข้อมูล...</td>
            </tr>
            <tr v-else-if="!state.trendFunds.length">
              <td colspan="4">ยังไม่มีข้อมูล uptrend</td>
            </tr>
            <tr v-for="fund in state.trendFunds" v-else :key="fund.code || fund.name">
              <td class="l">
                <strong>{{ fund.code || '-' }}</strong>
                <span>{{ fundName(fund) }}</span>
              </td>
              <td class="c" :class="{ positive: returnValue(fund) >= 0, negative: returnValue(fund) < 0 }">
                {{ formatPercent(returnValue(fund)) }}
              </td>
              <td class="c"><span class="fi-risk-badge" :class="`fi-risk-${fund.risk || 0}`">{{ fund.risk || '-' }}</span></td>
              <td class="c">{{ fund.amc || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="state.tab === 'valuation'" class="fi-body">
      <div class="fi-section-hdr">
        <div>
          <h3>💎 Valuation</h3>
          <p>API /insights/valuation</p>
        </div>
      </div>
      <div class="fi-tbl-wrap">
        <table class="fi-tbl">
          <thead>
            <tr>
              <th class="l">กองทุน</th>
              <th class="c">PE Zone</th>
              <th class="c">Upside</th>
              <th class="r">AUM</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading.page && !state.valuationFunds.length">
              <td colspan="4">กำลังโหลดข้อมูล...</td>
            </tr>
            <tr v-else-if="!state.valuationFunds.length">
              <td colspan="4">ยังไม่มีข้อมูล valuation</td>
            </tr>
            <tr v-for="fund in state.valuationFunds" v-else :key="fund.code || fund.name">
              <td class="l"><strong>{{ fund.code || '-' }}</strong></td>
              <td class="c"><span class="fi-zone fi-zone-f">{{ fund.pe_zone || fund.valuation_zone || fund.zone || '-' }}</span></td>
              <td class="c" :class="{ positive: Number(fund.upside_to_avg || returnValue(fund)) >= 0, negative: Number(fund.upside_to_avg || returnValue(fund)) < 0 }">
                {{ formatPercent(fund.upside_to_avg || returnValue(fund)) }}
              </td>
              <td class="r">฿{{ formatCompact(fund.aum || 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="fi-footer"><span>ข้อมูลเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน</span></div>

    <Teleport to="body">
      <div v-if="state.selectedFlow" class="fund-modal-backdrop" @click.self="closeFlowModal">
        <section class="fund-modal flow-detail-modal" role="dialog" aria-modal="true">
          <button class="fund-modal-close" aria-label="Close" @click="closeFlowModal">×</button>
          <div class="fund-modal-head">
            <span>{{ state.selectedFlowType }}</span>
            <h2>{{ themeLabel(state.selectedFlow) || '-' }}</h2>
            <p>ข้อมูลที่ API ส่งกลับมาสำหรับธีมนี้</p>
          </div>
          <div class="fund-modal-grid flow-detail-summary">
            <div>
              <span>Theme</span>
              <strong>{{ themeLabel(state.selectedFlow) || '-' }}</strong>
            </div>
            <div>
              <span>Flow</span>
              <strong :class="{ positive: flowValue(state.selectedFlow) >= 0, negative: flowValue(state.selectedFlow) < 0 }">
                {{ flowDisplayValue(state.selectedFlow) }}
              </strong>
            </div>
            <div>
              <span>Period</span>
              <strong>{{ state.period }}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{{ state.selectedFlowType || '-' }}</strong>
            </div>
          </div>
          <div class="flow-detail-raw">
            <h3>รายละเอียดจาก BE</h3>
            <dl>
              <template v-for="row in flowDetailRows(state.selectedFlow)" :key="row.key">
                <dt>{{ row.key }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </div>
          <div class="flow-detail-raw">
            <div class="flow-detail-title-row">
              <h3>ข้อมูลเพิ่มเติมของธีม</h3>
              <button class="flow-detail-load-btn" :disabled="loading.flowDetail" @click="fetchFlowDetailApi">
                {{ loading.flowDetail ? 'กำลังโหลด...' : 'โหลดจาก API' }}
              </button>
            </div>
            <p v-if="loading.flowDetail" class="muted">กำลังเรียก API รายละเอียด...</p>
            <p v-else-if="state.selectedFlowDetailError" class="alert">{{ state.selectedFlowDetailError }}</p>
            <dl v-else-if="flowTrendRows(state.selectedFlowDetail).length">
              <template v-for="row in flowTrendRows(state.selectedFlowDetail)" :key="`api-${row.key}`">
                <dt>{{ row.key }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
            <p v-else class="muted">ยังไม่มีข้อมูลเพิ่มในหน้านี้ กดโหลดจาก API เพื่อเรียกข้อมูลธีมนี้โดยตรง</p>
          </div>
        </section>
      </div>

      <div v-if="state.selectedFund" class="fund-modal-backdrop" @click.self="closeFundModal">
        <section class="fund-modal" role="dialog" aria-modal="true">
          <button class="fund-modal-close" aria-label="Close" @click="closeFundModal">×</button>
          <div class="fund-modal-head">
            <span>{{ state.selectedFundTheme }}</span>
            <h2>{{ state.selectedFund.code || '-' }}</h2>
            <p>{{ fundName(state.selectedFund) }}</p>
          </div>
          <div class="fund-modal-grid">
            <div>
              <span>AMC</span>
              <strong>{{ state.selectedFund.amc || '-' }}</strong>
            </div>
            <div>
              <span>Sector</span>
              <strong>{{ state.selectedFund.sector || state.selectedFund.category || '-' }}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{{ state.selectedFund.risk || '-' }}</strong>
            </div>
            <div>
              <span>1Y Return</span>
              <strong :class="{ positive: returnValue(state.selectedFund) >= 0, negative: returnValue(state.selectedFund) < 0 }">
                {{ formatPercent(returnValue(state.selectedFund)) }}
              </strong>
            </div>
            <div>
              <span>1M Return</span>
              <strong :class="{ positive: Number(state.selectedFund.return_1m || 0) >= 0, negative: Number(state.selectedFund.return_1m || 0) < 0 }">
                {{ formatPercent(state.selectedFund.return_1m || 0) }}
              </strong>
            </div>
            <div>
              <span>AUM</span>
              <strong>฿{{ formatCompact(fundAum(state.selectedFund)) }}</strong>
            </div>
            <div>
              <span>NAV</span>
              <strong>{{ formatCompact(fundNav(state.selectedFund)) }}</strong>
            </div>
            <div>
              <span>Theme Rank</span>
              <strong>#{{ state.selectedFund.rank || '-' }}</strong>
            </div>
          </div>
          <div class="fund-modal-chart">
            <h3>Inflow / Outflow {{ state.period }}</h3>
            <div v-if="fundFlowSeries(state.selectedFund).length" class="gf-mini-flow-chart modal-chart">
              <div
                v-for="point in fundFlowSeries(state.selectedFund)"
                :key="`modal-${point.date || point.year || point.label}`"
                class="gf-mini-flow-point"
              >
                <i
                  :class="{ positive: flowPointValue(point) >= 0, negative: flowPointValue(point) < 0 }"
                  :style="{ height: flowBarHeight(point, fundFlowSeries(state.selectedFund)) }"
                ></i>
                <span>{{ flowPointLabel(point) }}</span>
              </div>
            </div>
            <p v-else class="muted">ไม่มีข้อมูล Inflow / Outflow</p>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>
