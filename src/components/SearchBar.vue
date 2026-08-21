<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { reconGet } from '../services/apiClient'

const router = useRouter()

const query = ref('')
const results = ref([])
const loading = ref(false)
const open = ref(false)
const activeIdx = ref(-1)

const wrapRef = ref(null)
let debounceTimer = null

// ===== API =====
async function fetchSuggestions(q) {
  loading.value = true
  try {
    const data = await reconGet('/search/suggestions', { q, type: 'TH' })
    // รองรับหลาย shape: array ตรง / { results } / { suggestions } / { data }
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.results)) return data.results
    if (Array.isArray(data?.suggestions)) return data.suggestions
    if (Array.isArray(data?.data)) return data.data
    return []
  } catch {
    return []
  } finally {
    loading.value = false
  }
}

// ===== Input handler =====
function onInput() {
  const q = query.value.trim()
  clearTimeout(debounceTimer)
  activeIdx.value = -1

  if (q.length < 1) {
    results.value = []
    open.value = false
    return
  }

  loading.value = true
  open.value = true

  debounceTimer = setTimeout(async () => {
    const q2 = query.value.trim()
    if (!q2) return
    results.value = await fetchSuggestions(q2)
  }, 300)
}

// ===== Keyboard navigation =====
function onKeydown(e) {
  if (!open.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIdx.value >= 0 && results.value[activeIdx.value]) {
      selectItem(results.value[activeIdx.value])
    } else {
      goSearch()
    }
  } else if (e.key === 'Escape') {
    close()
  }
}

// ===== Navigate =====
function selectItem(item) {
  const symbol = item.id || item.symbol || item.code || ''
  const rawType = (item.type || '').toUpperCase()
  const isStock = rawType === 'STOCK' || rawType === 'EQUITY'
  const isFund = rawType === 'FUND' || rawType === 'MUTUAL_FUND' || rawType === 'ETF'

  close()
  query.value = symbol

  if (isStock) {
    router.push(`/dashboard?view=stock&symbol=${encodeURIComponent(symbol)}`)
  } else if (isFund) {
    router.push(`/dashboard?view=fund&code=${encodeURIComponent(symbol)}`)
  } else {
    router.push(`/dashboard?symbols=${encodeURIComponent(symbol)}`)
  }
}

function goSearch() {
  const q = query.value.trim()
  close()
  if (!q) return
  router.push(`/dashboard?symbols=${encodeURIComponent(q.toUpperCase())}`)
}

function close() {
  open.value = false
  activeIdx.value = -1
}

// ===== Click outside =====
function onClickOutside(e) {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) {
    close()
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))

// ===== Helpers =====
function getTypeClass(item) {
  const t = (item.type || '').toUpperCase()
  if (t === 'STOCK' || t === 'EQUITY') return 'type-stock'
  if (t === 'FUND' || t === 'MUTUAL_FUND') return 'type-fund'
  if (t === 'ETF') return 'type-etf'
  return 'type-other'
}

function getTypeLabel(item) {
  const t = (item.type || '').toUpperCase()
  if (t === 'STOCK' || t === 'EQUITY') return 'STOCK'
  if (t === 'MUTUAL_FUND') return 'FUND'
  if (t === 'ETF') return 'ETF'
  return t || '-'
}

function getSymbol(item) {
  return item.id || item.symbol || item.code || ''
}

function getName(item) {
  return item.name || item.fund_name || item.stock_name || ''
}
</script>

<template>
  <div class="sb-wrap" ref="wrapRef">
    <form class="sb-form" @submit.prevent="goSearch">
      <span class="sb-icon-left">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
      </span>
      <input
        id="global-search-input"
        v-model="query"
        type="search"
        class="sb-input"
        placeholder="ค้นหากองทุน / หุ้น..."
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @keydown="onKeydown"
        @focus="open = results.length > 0"
      />
      <span v-if="loading" class="sb-spinner" aria-hidden="true"></span>
    </form>

    <!-- Dropdown -->
    <Transition name="sb-drop">
      <div v-if="open" class="sb-dropdown" role="listbox" aria-label="ผลการค้นหา">

        <!-- Loading state -->
        <div v-if="loading && results.length === 0" class="sb-state">
          <span class="sb-dot-loader">
            <span></span><span></span><span></span>
          </span>
          กำลังค้นหา...
        </div>

        <!-- Empty state -->
        <div v-else-if="!loading && results.length === 0" class="sb-state sb-empty">
          ไม่พบผลลัพธ์สำหรับ "{{ query }}"
        </div>

        <!-- Results -->
        <template v-else>
          <div class="sb-header">
            <span class="sh-symbol">Symbol</span>
            <span class="sh-name">ชื่อ</span>
            <span class="sh-type">ประเภท</span>
          </div>

          <div
            v-for="(item, i) in results.slice(0, 8)"
            :key="getSymbol(item) + i"
            class="sb-item"
            :class="{ active: i === activeIdx }"
            role="option"
            :aria-selected="i === activeIdx"
            @mouseenter="activeIdx = i"
            @mousedown.prevent="selectItem(item)"
          >
            <span class="si-symbol">{{ getSymbol(item) }}</span>
            <span class="si-name">{{ getName(item) }}</span>
            <span class="si-badge" :class="getTypeClass(item)">{{ getTypeLabel(item) }}</span>
          </div>
        </template>

      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Wrapper ── */
.sb-wrap {
  position: relative;
}

/* ── Form / Input ── */
.sb-form {
  position: relative;
  display: flex;
  align-items: center;
}

.sb-icon-left {
  position: absolute;
  left: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  pointer-events: none;
  transition: color 0.2s;
}

.sb-input {
  width: 220px;
  height: 38px;
  padding: 0 36px 0 36px;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  font-size: 13px;
  background: var(--surface-soft);
  color: var(--text);
  outline: none;
  transition: all 0.25s;
  /* ซ่อน X ของ type=search บาง browser */
  -webkit-appearance: none;
}

.sb-input::placeholder {
  color: var(--muted);
}

.sb-input::-webkit-search-cancel-button {
  display: none;
}

.sb-input:focus {
  width: 280px;
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.sb-input:focus ~ .sb-icon-left,
.sb-form:has(.sb-input:focus) .sb-icon-left {
  color: var(--accent);
}

/* Spinner while fetching */
.sb-spinner {
  position: absolute;
  right: 12px;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sb-spin 0.65s linear infinite;
  pointer-events: none;
}

@keyframes sb-spin {
  to { transform: rotate(360deg); }
}

/* ── Dropdown ── */
.sb-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 340px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.14);
  z-index: 99999;
  overflow: hidden;
}

/* Transition */
.sb-drop-enter-active,
.sb-drop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sb-drop-enter-from,
.sb-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Header row */
.sb-header {
  display: flex;
  align-items: center;
  padding: 6px 14px;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

/* Result item */
.sb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f0f4f8;
  transition: background 0.1s;
}

.sb-item:last-child {
  border-bottom: none;
}

.sb-item:hover,
.sb-item.active {
  background: var(--accent-soft);
}

/* Column sizes */
.sh-symbol { width: 90px; flex-shrink: 0; }
.sh-name   { flex: 1; }
.sh-type   { width: 60px; flex-shrink: 0; text-align: center; }

.si-symbol {
  width: 90px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.si-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Type badges */
.si-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.type-stock { background: #eef2ff; color: #4f46e5; }
.type-fund  { background: #fdf2f8; color: #db2777; }
.type-etf   { background: #ecfdf5; color: #059669; }
.type-other { background: #f8fafc; color: var(--muted); }

/* States */
.sb-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 22px 14px;
  font-size: 13px;
  color: var(--muted);
}

.sb-empty {
  font-style: italic;
}

/* Dot loader */
.sb-dot-loader {
  display: flex;
  gap: 4px;
}

.sb-dot-loader span {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: sb-bounce 0.6s ease-in-out infinite alternate;
}

.sb-dot-loader span:nth-child(2) { animation-delay: 0.15s; }
.sb-dot-loader span:nth-child(3) { animation-delay: 0.3s; }

@keyframes sb-bounce {
  from { opacity: 0.3; transform: scaleY(0.5); }
  to   { opacity: 1;   transform: scaleY(1); }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .sb-input         { width: 160px; }
  .sb-input:focus   { width: 200px; }
  .sb-dropdown      { min-width: 280px; left: auto; right: 0; }
}
</style>
