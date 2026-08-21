import { reconGet, wpGet } from './apiClient'
import { FUNDS, FUND_TYPES, fundsByType } from '../data/fundinfoData'

// Input Validation — whitelist enums/patterns, reused by router guards & stores later
export const VALID_FUND_TYPES = Object.freeze(Object.keys(FUND_TYPES))
export const FUND_ID_PATTERN = /^[A-Za-z0-9-]{1,32}$/

export function isValidFundType(type) {
  return typeof type === 'string' && VALID_FUND_TYPES.includes(type)
}

export function isValidFundId(id) {
  return typeof id === 'string' && FUND_ID_PATTERN.test(id)
}

// Feature switch — 'mock' preserves today's local CSV data untouched; flip to
// 'direct' | 'wordpress' once the backend endpoints below are live. No component
// code needs to change when the switch flips, only this file's env var.
export const fundinfoApiMode = import.meta.env.VITE_FUNDINFO_API_MODE || 'mock'

// Error Handling — never leak axios/stack/backend internals to the UI layer
function toSafeError(error, fallbackMessage) {
  if (import.meta.env.DEV) console.error('[fundinfoApi]', error)
  return new Error(fallbackMessage)
}

function extractFundList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.funds)) return payload.funds
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

// Auth — placeholder for the future backend hop: pass a Bearer token once
// fundinfo endpoints require it (see authGet/authPost in apiClient.js).
export async function fetchFundsByType(type) {
  if (!isValidFundType(type)) {
    throw new Error('Invalid fund type requested')
  }

  if (fundinfoApiMode === 'mock') {
    return fundsByType(type)
  }

  try {
    const payload =
      fundinfoApiMode === 'wordpress'
        ? await wpGet('fundinfo_list', { type })
        : await reconGet('/fundinfo/list', { type })

    return extractFundList(payload)
  } catch (error) {
    throw toSafeError(error, 'ไม่สามารถโหลดข้อมูลกองทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchFundById(id) {
  if (!isValidFundId(id)) {
    throw new Error('Invalid fund id requested')
  }

  if (fundinfoApiMode === 'mock') {
    return FUNDS.find((fund) => fund.id === id) || null
  }

  try {
    const payload =
      fundinfoApiMode === 'wordpress'
        ? await wpGet('fundinfo_detail', { id })
        : await reconGet(`/fundinfo/${encodeURIComponent(id)}`)

    return payload?.fund || payload || null
  } catch (error) {
    throw toSafeError(error, 'ไม่พบข้อมูลกองทุนที่ร้องขอ')
  }
}

export function fundTypeOptions() {
  return VALID_FUND_TYPES
}
