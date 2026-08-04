import { wpGet, wpRestGet } from './apiClient'

// สลับแหล่งข้อมูลได้ด้วย env ตัวเดียว ไม่ต้องแก้โค้ดหน้าอื่นเลย
//   'ajax'   -> ยิงผ่าน WP AJAX (wp_ajax_fund_articles_*) เหมือน insightsApi.js เป๊ะ ๆ
//               (ค่า default ใหม่ — ไม่ชน SSL cert เพราะเดินผ่าน /wp-admin/admin-ajax.php
//               ที่ proxy ไว้ใน vite.config.js เหมือนที่ insights ใช้)
//   'static' -> โหลดจาก public/posts.json (ใช้ตอนไม่มีทาง reach WP ได้เลย)
//   'api'    -> ยิง WordPress REST API ตรง ๆ (ของเดิม เก็บไว้เป็น fallback/legacy)
const DATA_SOURCE = import.meta.env.VITE_ARTICLES_DATA_SOURCE || 'ajax'
const STATIC_JSON_URL = import.meta.env.VITE_ARTICLES_STATIC_JSON || '/posts.json'

// โพสต์ที่ต้องการปักหมุดเป็น featured banner บนสุดเสมอ เปลี่ยนได้ผ่าน
// VITE_FEATURED_ARTICLE_ID ใน .env โดยไม่ต้องแก้โค้ด
const FEATURED_ARTICLE_ID = Number(import.meta.env.VITE_FEATURED_ARTICLE_ID || 511)

// แท็บหมวดหมู่ตรงตามดีไซน์ 100% -> map เป็น WordPress category id จริง
export const ARTICLE_CATEGORY_TABS = [
  { id: 'all', name: 'ทั้งหมด', categoryId: null },
  { id: 'start', name: 'รู้เรื่องกองทุนฉบับเริ่มต้น', categoryId: 7 },
  { id: 'thai', name: 'กองทุนไทย', categoryId: 8 },
  { id: 'foreign', name: 'กองทุนต่างประเทศ', categoryId: 9 },
  { id: 'news', name: 'ข่าวสาร', categoryId: 5 },
]

const HTML_TAG_PATTERN = /<[^>]*>/g
const CONTENT_IMG_PATTERN = /<img[^>]+src=["']([^"']+)["']/i

function decodeHtmlEntities(text) {
  if (!text) return ''

  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

function plainText(html) {
  return decodeHtmlEntities(String(html || '').replace(HTML_TAG_PATTERN, '')).trim()
}

function formatDisplayDate(dateString) {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function featuredImage(post) {
  const media = post._embedded?.['wp:featuredmedia']?.[0]

  if (media && !media.code) {
    const url =
      media.media_details?.sizes?.medium_large?.source_url ||
      media.media_details?.sizes?.medium?.source_url ||
      media.source_url

    if (url) return url
  }

  // บางโพสต์ (เช่นโพสต์ที่ใช้เป็น featured banner) ไม่ได้ตั้ง featured image ไว้
  // เลยดึงรูปแรกที่เจอในเนื้อหาบทความมาใช้แทน
  const match = String(post.content?.rendered || '').match(CONTENT_IMG_PATTERN)
  return match ? match[1] : ''
}

// ใช้กับผลลัพธ์ WP REST shape ดิบ ๆ เท่านั้น (โหมด static / api) — โหมด ajax ฝั่ง PHP
// (fund_v5_format_article ใน articles-api-handlers.php) ส่ง shape นี้มาพร้อมใช้แล้ว
// เลยไม่ต้องเข้า normalizeArticle อีกชั้น
function normalizeArticle(post) {
  return {
    id: post.id,
    title: decodeHtmlEntities(post.title?.rendered || ''),
    excerpt: plainText(post.excerpt?.rendered || ''),
    content: post.content?.rendered || '',
    date: formatDisplayDate(post.date || post.date_gmt || ''),
    thumbnail: featuredImage(post),
    link: post.link || '',
    categories: post.categories || [],
    rawDate: post.date || post.date_gmt || '',
  }
}

function errorFromWpRest(error) {
  return {
    message: error?.response?.data?.message || 'โหลดบทความไม่สำเร็จ',
    status: error?.response?.status || 0,
  }
}

function errorFromAjax(error) {
  return {
    message: error?.message || error?.error || 'โหลดบทความไม่สำเร็จ',
    status: error?.status || 0,
  }
}

// ---------- static posts.json mode ----------

let staticPostsCache = null

async function loadStaticPosts() {
  if (staticPostsCache) return staticPostsCache

  const response = await fetch(STATIC_JSON_URL)

  if (!response.ok) {
    throw { message: `โหลด ${STATIC_JSON_URL} ไม่สำเร็จ (${response.status})`, status: response.status }
  }

  staticPostsCache = await response.json()
  return staticPostsCache
}

function sortByDateDesc(posts) {
  return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ---------- public API (หน้าตาเหมือนกันไม่ว่าจะใช้ source ไหน) ----------

export async function getArticles({ page = 1, perPage = 6, categoryId = null, excludeId = null } = {}) {
  if (DATA_SOURCE === 'ajax') {
    try {
      // เหมือน insightsApi.js เป๊ะ ๆ: wpGet(action, params) ยิงผ่าน
      // /wp-admin/admin-ajax.php ตัวเดียวกับที่ insights ใช้
      const payload = await wpGet('fund_articles_list', {
        page,
        per_page: perPage,
        category: categoryId || 0,
        exclude: excludeId || 0,
      })

      return {
        articles: payload?.articles || [],
        totalPages: payload?.totalPages || 1,
      }
    } catch (error) {
      throw errorFromAjax(error)
    }
  }

  if (DATA_SOURCE === 'static') {
    const posts = await loadStaticPosts()
    const filtered = categoryId
      ? posts.filter((post) => (post.categories || []).includes(categoryId))
      : posts

    const sorted = sortByDateDesc(filtered)
    const start = (page - 1) * perPage
    const pageItems = sorted.slice(start, start + perPage)

    return {
      articles: pageItems.map(normalizeArticle),
      totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
    }
  }

  // 'api' -> WP REST ตรง ๆ (legacy)
  const params = {
    page,
    per_page: perPage,
    _embed: true,
    orderby: 'date',
    order: 'desc',
    status: 'publish',
  }

  if (categoryId) params.categories = categoryId

  try {
    const { data, totalPages } = await wpRestGet('/posts', params)

    return {
      articles: (Array.isArray(data) ? data : []).map(normalizeArticle),
      totalPages: totalPages || 1,
    }
  } catch (error) {
    throw errorFromWpRest(error)
  }
}

export async function getArticleById(id) {
  if (!id) return null

  if (DATA_SOURCE === 'ajax') {
    try {
      const payload = await wpGet('fund_articles_detail', { id })
      if (payload?.error) return null
      return payload?.article || null
    } catch (error) {
      throw errorFromAjax(error)
    }
  }

  if (DATA_SOURCE === 'static') {
    const posts = await loadStaticPosts()
    const post = posts.find((item) => item.id === Number(id))
    return post ? normalizeArticle(post) : null
  }

  try {
    const { data } = await wpRestGet(`/posts/${id}`, { _embed: true })
    return data ? normalizeArticle(data) : null
  } catch (error) {
    if (error?.response?.status === 404) return null
    throw errorFromWpRest(error)
  }
}

export async function getFeaturedArticle() {
  return getArticleById(FEATURED_ARTICLE_ID)
}

export async function getRecentArticles({ excludeId = null, limit = 4 } = {}) {
  if (DATA_SOURCE === 'ajax') {
    try {
      const { articles } = await getArticles({ page: 1, perPage: limit, excludeId })
      return articles
    } catch {
      return []
    }
  }

  if (DATA_SOURCE === 'static') {
    const posts = await loadStaticPosts()
    const filtered = excludeId ? posts.filter((item) => item.id !== Number(excludeId)) : posts
    return sortByDateDesc(filtered).slice(0, limit).map(normalizeArticle)
  }

  const params = {
    per_page: limit,
    orderby: 'date',
    order: 'desc',
    status: 'publish',
  }

  if (excludeId) params.exclude = excludeId

  try {
    const { data } = await wpRestGet('/posts', params)
    return (Array.isArray(data) ? data : []).map(normalizeArticle)
  } catch {
    return []
  }
}