/**
 * Helper utility สำหรับจัดการ SEO Meta Tags แบบ Dynamic
 */

const DEFAULT_TITLE = 'IDEA FUND - แพลตฟอร์มค้นหาและวิเคราะห์ข้อมูลกองทุนรวม และหุ้น'
const DEFAULT_DESCRIPTION =
  'IDEA FUND แพลตฟอร์มวิเคราะห์ข้อมูลกองทุนรวมและหุ้นไทย-ต่างประเทศ รวมข้อมูลผลตอบแทน แนวโน้ม Uptrend, Valuation, Global Fund Flow และบทวิเคราะห์เจาะลึก'
const DEFAULT_KEYWORDS = 'กองทุนรวม, หุ้นไทย, หุ้นต่างประเทศ, ETF, วิเคราะห์กองทุน, IDEA FUND, FUNDINFO, ผลตอบแทนกองทุน'
const DEFAULT_IMAGE = '/favicon.svg'

/**
 * อัปเดต Meta Tag ใน <head>
 * @param {string} selector - CSS Selector ของ Meta Tag เช่น 'meta[name="description"]'
 * @param {string} attrName - ชื่อแอตทริบิวต์ที่เก็บค่า เช่น 'content'
 * @param {string} attrValue - ค่าที่ต้องการตั้ง
 * @param {string} createTagName - ประเภท Element ถ้ายังไม่มีใน head เช่น 'meta'
 * @param {Object} createAttrs - แอตทริบิวต์ที่จะใส่เพิ่มกรณีสร้าง Element ใหม่
 */
function setMetaTag(selector, attrName, attrValue, createTagName = 'meta', createAttrs = {}) {
  let element = document.head.querySelector(selector)
  if (!element && attrValue) {
    element = document.createElement(createTagName)
    Object.entries(createAttrs).forEach(([k, v]) => element.setAttribute(k, v))
    document.head.appendChild(element)
  }
  if (element && attrValue !== undefined) {
    element.setAttribute(attrName, attrValue)
  }
}

/**
 * ฟังก์ชันหลักในการอัปเดต Meta Tags และ Document Title
 */
export function updateSeoMeta(options = {}) {
  const title = options.title || DEFAULT_TITLE
  const description = options.description || DEFAULT_DESCRIPTION
  const keywords = options.keywords || DEFAULT_KEYWORDS
  const ogTitle = options.ogTitle || title
  const ogDescription = options.ogDescription || description
  const ogImage = options.ogImage || DEFAULT_IMAGE
  const ogType = options.ogType || 'website'
  const canonicalUrl = options.canonicalUrl || window.location.href

  // 1. Title
  document.title = title

  // 2. Standard Meta Tags
  setMetaTag('meta[name="description"]', 'content', description, 'meta', { name: 'description' })
  setMetaTag('meta[name="keywords"]', 'content', keywords, 'meta', { name: 'keywords' })
  setMetaTag('meta[name="robots"]', 'content', 'index, follow', 'meta', { name: 'robots' })

  // 3. Open Graph (Facebook / Line / Social Media)
  setMetaTag('meta[property="og:title"]', 'content', ogTitle, 'meta', { property: 'og:title' })
  setMetaTag('meta[property="og:description"]', 'content', ogDescription, 'meta', { property: 'og:description' })
  setMetaTag('meta[property="og:type"]', 'content', ogType, 'meta', { property: 'og:type' })
  setMetaTag('meta[property="og:url"]', 'content', canonicalUrl, 'meta', { property: 'og:url' })
  setMetaTag('meta[property="og:image"]', 'content', ogImage, 'meta', { property: 'og:image' })
  setMetaTag('meta[property="og:site_name"]', 'content', 'IDEA FUND', 'meta', { property: 'og:site_name' })
  setMetaTag('meta[property="og:locale"]', 'content', 'th_TH', 'meta', { property: 'og:locale' })

  // 4. Twitter Card
  setMetaTag('meta[name="twitter:card"]', 'content', 'summary_large_image', 'meta', { name: 'twitter:card' })
  setMetaTag('meta[name="twitter:title"]', 'content', ogTitle, 'meta', { name: 'twitter:title' })
  setMetaTag('meta[name="twitter:description"]', 'content', ogDescription, 'meta', { name: 'twitter:description' })
  setMetaTag('meta[name="twitter:image"]', 'content', ogImage, 'meta', { name: 'twitter:image' })

  // 5. Canonical Link
  setMetaTag('link[rel="canonical"]', 'href', canonicalUrl, 'link', { rel: 'canonical' })
}
