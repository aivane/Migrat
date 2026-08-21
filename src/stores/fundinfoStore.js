import { defineStore } from 'pinia'
import { fetchFundById, fetchFundsByType, isValidFundId, isValidFundType } from '../services/fundinfoApi'

// Secure State — public market data only (no tokens/PII), kept in-memory only.
// Never persisted to localStorage: avoids stale/unbounded cache growth and
// keeps this store safe to expose to devtools without a data-exposure concern.
export const useFundinfoStore = defineStore('fundinfo', {
  state: () => ({
    fundsByType: {}, // { feeder: [...], offshore: [...], thai: [...], mixed: [...] }
    fundById: {}, // single-fund detail cache, keyed by validated id
    loading: {}, // per-key ('feeder', 'SCBNDQ', ...) in-flight flags
    error: {}, // per-key sanitized user-facing error message
  }),

  getters: {
    getFundsByType: (state) => (type) => state.fundsByType[type] || [],
    getFundById: (state) => (id) => state.fundById[id] || null,
    isLoading: (state) => (key) => Boolean(state.loading[key]),
    getError: (state) => (key) => state.error[key] || null,
  },

  actions: {
    // Auth Guard-adjacent — reject unknown types before ever touching the network
    async loadFundsByType(type, { force = false } = {}) {
      if (!isValidFundType(type)) {
        this.error[type] = 'ประเภทกองทุนไม่ถูกต้อง'
        return []
      }

      if (!force && this.fundsByType[type]) return this.fundsByType[type]

      this.loading[type] = true
      this.error[type] = null

      try {
        const funds = await fetchFundsByType(type)
        this.fundsByType[type] = funds
        return funds
      } catch (err) {
        // Error Handling — store only the sanitized message from fundinfoApi,
        // never the raw exception/axios response
        this.error[type] = err.message
        return []
      } finally {
        this.loading[type] = false
      }
    },

    async loadFundById(id, { force = false } = {}) {
      if (!isValidFundId(id)) {
        this.error[id] = 'รหัสกองทุนไม่ถูกต้อง'
        return null
      }

      if (!force && this.fundById[id]) return this.fundById[id]

      this.loading[id] = true
      this.error[id] = null

      try {
        const fund = await fetchFundById(id)
        if (fund) this.fundById[id] = fund
        else this.error[id] = 'ไม่พบข้อมูลกองทุนที่ร้องขอ'
        return fund
      } catch (err) {
        this.error[id] = err.message
        return null
      } finally {
        this.loading[id] = false
      }
    },

    clearErrors() {
      this.error = {}
    },
  },
})
