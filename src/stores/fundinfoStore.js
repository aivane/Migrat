import { defineStore } from 'pinia'
import {
  fetchFundById,
  fetchFundsByType,
  fetchPortfolioAllocation,
  fetchTopStocksByMarket,
  isValidAllocationType,
  isValidFundId,
  isValidFundType,
  isValidStockMarket,
} from '../services/fundinfoApi'

// Performance — composables can mount together; share each pending request instead of duplicating API calls.
const listRequests = new Map()
const detailRequests = new Map()
const topStockRequests = new Map()
const portfolioAllocationRequests = new Map()

function normalizePortfolioRequest({ marketType = '', fundCodes = [], allocationType = '' } = {}) {
  const normalizedMarketType = String(marketType || '').toUpperCase()
  const normalizedAllocationType = String(allocationType || '').toUpperCase()
  const codes = [...new Set(
    (Array.isArray(fundCodes) ? fundCodes : [])
      .filter(isValidFundId)
      .slice(0, 50),
  )].sort()

  if (normalizedMarketType && !isValidStockMarket(normalizedMarketType)) return null
  if (normalizedAllocationType && !isValidAllocationType(normalizedAllocationType)) return null

  return { marketType: normalizedMarketType, fundCodes: codes, allocationType: normalizedAllocationType }
}

function portfolioAllocationKey(request) {
  return `${request.marketType || 'ALL'}:${request.allocationType || 'ALL'}:${request.fundCodes.join(',')}`
}

// Secure State — public market data only (no tokens/PII), kept in-memory only.
// Never persisted to localStorage: avoids stale/unbounded cache growth and
// keeps this store safe to expose to devtools without a data-exposure concern.
export const useFundinfoStore = defineStore('fundinfo', {
  state: () => ({
    fundsByType: {}, // { feeder: [...], offshore: [...], thai: [...], mixed: [...] }
    fundById: {}, // single-fund detail cache, keyed by validated id
    topStocksByMarket: {}, // { TH: [...], FOREIGN: [...] }, public ranking data only
    portfolioAllocationByKey: {}, // public aggregate allocation data, keyed by validated request scope
    detailLoaded: {}, // distinguishes an API profile from an item returned by the list endpoint
    loading: {}, // per-key ('feeder', 'SCBNDQ', ...) in-flight flags
    error: {}, // per-key sanitized user-facing error message
  }),

  getters: {
    getFundsByType: (state) => (type) => state.fundsByType[type] || [],
    getFundById: (state) => (id) => state.fundById[id] || null,
    getTopStocksByMarket: (state) => (marketType) => state.topStocksByMarket[marketType] || [],
    getPortfolioAllocation: (state) => (options = {}) => {
      const request = normalizePortfolioRequest(options)
      return request ? state.portfolioAllocationByKey[portfolioAllocationKey(request)] || [] : []
    },
    hasFundDetail: (state) => (id) => Boolean(state.detailLoaded[id]),
    isLoading: (state) => (key) => Boolean(state.loading[key]),
    getError: (state) => (key) => state.error[key] || null,
  },

  actions: {
    mergeFundIntoCachedLists(fund) {
      if (!fund || !isValidFundId(fund.id)) return

      Object.entries(this.fundsByType).forEach(([type, funds]) => {
        const index = funds.findIndex((item) => item.id === fund.id)
        if (index === -1) return

        const updated = [...funds]
        updated[index] = fund
        this.fundsByType[type] = updated
      })
    },

    // Auth Guard-adjacent — reject unknown types before ever touching the network
    async loadFundsByType(type, { force = false } = {}) {
      if (!isValidFundType(type)) {
        this.error[type] = 'ประเภทกองทุนไม่ถูกต้อง'
        return []
      }

      if (!force && this.fundsByType[type]) return this.fundsByType[type]
      if (listRequests.has(type)) return listRequests.get(type)

      this.loading[type] = true
      this.error[type] = null

      const request = fetchFundsByType(type)
        .then((funds) => {
          // Preserve a profile that may have arrived while this list request was pending.
          const mergedFunds = funds.map((fund) =>
            this.detailLoaded[fund.id] ? this.fundById[fund.id] || fund : fund,
          )
          this.fundsByType[type] = mergedFunds
          return mergedFunds
        })
        .catch((err) => {
          // Error Handling — store only the sanitized message from fundinfoApi,
          // never the raw exception/axios response.
          this.error[type] = err?.message || 'ไม่สามารถโหลดข้อมูลกองทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
          return []
        })
        .finally(() => {
          this.loading[type] = false
          listRequests.delete(type)
        })

      listRequests.set(type, request)
      return request
    },

    async loadFundById(id, { force = false } = {}) {
      if (!isValidFundId(id)) {
        this.error[id] = 'รหัสกองทุนไม่ถูกต้อง'
        return null
      }

      if (!force && this.detailLoaded[id] && this.fundById[id]) return this.fundById[id]
      if (detailRequests.has(id)) return detailRequests.get(id)

      this.loading[id] = true
      this.error[id] = null

      const request = fetchFundById(id)
        .then((fund) => {
          if (!fund) {
            this.error[id] = 'ไม่พบข้อมูลกองทุนที่ร้องขอ'
            return null
          }

          this.fundById[id] = fund
          this.detailLoaded[id] = true
          this.mergeFundIntoCachedLists(fund)
          return fund
        })
        .catch((err) => {
          this.error[id] = err?.message || 'ไม่พบข้อมูลกองทุนที่ร้องขอ'
          return null
        })
        .finally(() => {
          this.loading[id] = false
          detailRequests.delete(id)
        })

      detailRequests.set(id, request)
      return request
    },

    async loadTopStocksByMarket(marketType, { force = false } = {}) {
      const requestKey = `stocks:${marketType}`

      // Input Validation — whitelist markets before building a request URL.
      if (!isValidStockMarket(marketType)) {
        this.error[requestKey] = 'ตลาดหุ้นที่ร้องขอไม่ถูกต้อง'
        return []
      }

      if (!force && this.topStocksByMarket[marketType]) return this.topStocksByMarket[marketType]
      if (topStockRequests.has(marketType)) return topStockRequests.get(marketType)

      this.loading[requestKey] = true
      this.error[requestKey] = null

      const request = fetchTopStocksByMarket(marketType)
        .then((stocks) => {
          this.topStocksByMarket[marketType] = stocks
          return stocks
        })
        .catch((err) => {
          // Error Handling — API service supplies a safe Thai message only.
          this.error[requestKey] = err?.message || 'ไม่สามารถโหลดข้อมูลหุ้นจัดอันดับได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
          return []
        })
        .finally(() => {
          this.loading[requestKey] = false
          topStockRequests.delete(marketType)
        })

      topStockRequests.set(marketType, request)
      return request
    },

    async loadPortfolioAllocation(options = {}, { force = false } = {}) {
      const requestOptions = normalizePortfolioRequest(options)

      // Input Validation — never construct a cache key or API query from an
      // unvalidated market, allocation type, or fund code.
      if (!requestOptions) {
        this.error['allocation:invalid'] = 'เงื่อนไขสัดส่วนการลงทุนไม่ถูกต้อง'
        return []
      }

      const cacheKey = portfolioAllocationKey(requestOptions)
      const requestKey = `allocation:${cacheKey}`
      if (!force && Object.hasOwn(this.portfolioAllocationByKey, cacheKey)) {
        return this.portfolioAllocationByKey[cacheKey]
      }
      if (portfolioAllocationRequests.has(cacheKey)) return portfolioAllocationRequests.get(cacheKey)

      this.loading[requestKey] = true
      this.error[requestKey] = null

      const request = fetchPortfolioAllocation(requestOptions)
        .then((allocation) => {
          this.portfolioAllocationByKey[cacheKey] = allocation
          return allocation
        })
        .catch((err) => {
          // Error Handling — expose only the service's sanitized Thai message.
          this.error[requestKey] = err?.message || 'ไม่สามารถโหลดข้อมูลสัดส่วนการลงทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'
          return []
        })
        .finally(() => {
          this.loading[requestKey] = false
          portfolioAllocationRequests.delete(cacheKey)
        })

      portfolioAllocationRequests.set(cacheKey, request)
      return request
    },

    clearErrors() {
      this.error = {}
    },

    clearFundCache() {
      // Secure State — explicit in-memory reset only; no browser storage is involved.
      this.fundsByType = {}
      this.fundById = {}
      this.topStocksByMarket = {}
      this.portfolioAllocationByKey = {}
      this.detailLoaded = {}
      this.loading = {}
      this.error = {}
    },
  },
})
