import { wpGet } from './apiClient'

// ข้อมูล FAQ มีอยู่ใน WordPress เท่านั้น (ไม่มีฝั่ง recon backend)
// จึงเรียกผ่าน wpGet ตรง ๆ โดยไม่ต้องแยกตาม apiMode เหมือน insightsApi.js

function extractFaqs(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.faqs)) return payload.faqs
  if (Array.isArray(payload?.data?.faqs)) return payload.data.faqs

  return []
}

function extractCategories(payload) {
  if (Array.isArray(payload?.categories)) return payload.categories
  if (Array.isArray(payload?.data?.categories)) return payload.data.categories

  return []
}

export async function getFaqList(params = {}) {
  const payload = await wpGet('fund_faq_list', params)

  return {
    faqs: extractFaqs(payload),
    categories: extractCategories(payload),
  }
}