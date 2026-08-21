<template>
  <div class="page-wrapper">
    <!-- 1. Loading State -->
    <div v-if="loading" class="status-container">
      <p>กำลังโหลดเนื้อหาบทความ...</p>
    </div>

    <!-- 2. Main Article Content Container -->
    <div v-else-if="article" class="article-detail-container">
      <!-- ฝั่งซ้าย: สารบัญ (กว้าง 360px) -->
      <aside class="toc-sidebar">
        <div class="toc-card" :class="{ 'is-fixed': isSticky }">
          <h3>สารบัญ</h3>
          <ul v-if="tocList.length > 0">
            <li><a href="#article-top">หน้าแรก</a></li>
            <li 
              v-for="(item, index) in tocList" 
              :key="index"
              :class="{ 'sub-item': item.level === 3 }"
            >
              <a :href="'#' + item.id">{{ item.text }}</a>
            </li>
          </ul>
          <ul v-else>
            <li><a href="#article-top">หน้าแรก</a></li>
            <li><a href="#section-title">{{ article.title }}</a></li>
          </ul>
        </div>
      </aside>

      <!-- ฝั่งขวา: เนื้อหาบทความ -->
      <main class="article-content" id="article-top">
        <!-- รูป Header -->
        <div class="main-image-wrapper">
          <img :src="article.thumbnail" :alt="article.title" @error="handleImgError" />
        </div>

        <!-- หัวข้อบทความด้านล่างรูป -->
        <h1 id="section-title" class="article-title">{{ article.title }}</h1>

        <!-- เนื้อหาหลักจาก WordPress -->
        <div class="wordpress-content" v-html="article.content"></div>

        <!-- ส่วน MORE POSTS ด้านล่าง -->
        <section v-if="morePosts.length > 0" class="more-posts-section">
          <h4 class="more-posts-title">MORE POSTS</h4>
          <div class="more-posts-list">
            <div 
              v-for="item in morePosts" 
              :key="item.id" 
              class="more-post-item"
              @click="navigateToPost(item.id)"
            >
              <h5 class="post-item-title">{{ item.title }}</h5>
              <span class="post-item-date">{{ item.date }}</span>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 3. Not Found State -->
    <div v-else class="status-container">
      <h2>ไม่พบเนื้อหาบทความที่คุณต้องการ</h2>
      <router-link to="/articles" class="back-link">กลับไปยังหน้าบทความทั้งหมด</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticleById, getRecentArticles } from '../services/articlesApi'
import { updateSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()

const article = ref(null)
const loading = ref(true)
const tocList = ref([])
const morePosts = ref([])
const isSticky = ref(false)

const handleScroll = () => {
  isSticky.value = window.scrollY > 60
}

const handleImgError = (event) => {
  event.target.src = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80'
}

const processArticleContent = (rawContent) => {
  if (!rawContent) return { content: '', toc: [] }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawContent, 'text/html')

  // 1. ดักลบรูปภาพแรกในเนื้อหาออก
  const firstImg = doc.querySelector('img')
  if (firstImg) {
    const parentContainer = firstImg.closest('figure') || firstImg.closest('p') || firstImg
    parentContainer.remove()
  }

  // 2. ดักลบ สารบัญ ซ้ำซ้อนที่ติดมาจาก WordPress
  const tocSelectors = [
    '.toc', '#toc', '.table-of-contents', '.ez-toc-container',
    '.lwptoc', '#toc_container', '.wp-block-table-of-contents'
  ]
  tocSelectors.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => el.remove())
  })

  const allElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, strong')
  allElements.forEach((el) => {
    if (el.textContent.trim() === 'สารบัญ') {
      let next = el.nextElementSibling
      while (next && (next.tagName === 'UL' || next.tagName === 'OL' || next.tagName === 'P')) {
        const toRemove = next
        next = next.nextElementSibling
        toRemove.remove()
      }
      el.remove()
    }
  })

  // 3. ดึง h2/h3 มาสร้างสารบัญ Sidebar
  const headings = doc.querySelectorAll('h2, h3')
  const toc = []

  headings.forEach((heading, index) => {
    const id = `heading-${index + 1}`
    heading.setAttribute('id', id)

    toc.push({
      id,
      text: heading.textContent.trim(),
      level: heading.tagName.toLowerCase() === 'h3' ? 3 : 2,
    })
  })

  return {
    content: doc.body.innerHTML,
    toc,
  }
}

const fetchArticleData = async () => {
  loading.value = true
  const articleId = Number(route.params.id)

  try {
    const post = await getArticleById(articleId)

    if (post) {
      const { content, toc } = processArticleContent(post.content)

      article.value = {
        id: post.id,
        title: post.title || 'ไม่มีหัวข้อ',
        content,
        thumbnail: post.thumbnail,
      }
      tocList.value = toc
      morePosts.value = await getRecentArticles({ excludeId: articleId, limit: 4 })

      // อัปเดต SEO Meta Tags สำหรับบทความนี้โดยเฉพาะ
      updateSeoMeta({
        title: `${article.value.title} | IDEA FUND`,
        description: `อ่านบทวิเคราะห์การลงทุน เรื่อง "${article.value.title}" บนแพลตฟอร์ม IDEA FUND`,
        ogTitle: `${article.value.title} | IDEA FUND`,
        ogDescription: `บทความการลงทุน: ${article.value.title}`,
        ogImage: article.value.thumbnail,
      })
    } else {
      article.value = null
    }
  } catch (err) {
    console.error('Error fetching article detail:', err)
    article.value = null
  } finally {
    loading.value = false
  }
}

const navigateToPost = (id) => {
  router.push(`/articles/${id}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => route.params.id, () => {
  if (route.params.id) {
    fetchArticleData()
  }
})

onMounted(() => {
  fetchArticleData()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&display=swap');

html {
  scroll-behavior: smooth;
}

.page-wrapper {
  font-family: 'Kanit', sans-serif, system-ui;
  background-color: #f9fafb; /* ปรับพื้นหลังให้สว่าง สารบัญลอยเด่นขึ้น */
  color: #111827;
  min-height: 100vh;
}

/* Container หลัก ปรับให้กว้างขึ้นเล็กน้อยเพื่อรองรับ Sidebar 360px */
.article-detail-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
  display: grid;
  grid-template-columns: 360px 1fr; /* 🟢 สารบัญขนาด 360px */
  gap: 28px;                          /* 🟢 ระยะห่างระหว่าง Sidebar และ Content ตรงตามภาพ */
  align-items: start;
}

/* สารบัญ Sidebar */
.toc-sidebar {
  position: relative;
  width: 360px; /* 🟢 กำหนดความกว้าง 360px */
}

.toc-card {
  border: 1px solid #f3f4f6;
  border-radius: 16px; /* 🟢 ขอบโค้งมนตามแบบในรูปภาพ */
  padding: 24px;
  background: #ffffff;
  /* 🟢 นำสไตล์เงาแบบ Soft Drop Shadow ตามรูปภาพมาใส่ */
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  width: 360px;
  box-sizing: border-box;
}

/* สไตล์เมื่อเลื่อนเมาส์ลงมา (Fixed ลอยตามลูกกลิ้ง) */
.toc-card.is-fixed {
  position: fixed;
  top: 70px;
  width: 360px; /* 🟢 คงขนาด 360px ตอนลอย */
  z-index: 99;
  max-height: calc(100vh - 90px);
  overflow-y: auto;
}

.toc-card h3 {
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: #111827;
}

.toc-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-card li {
  margin-bottom: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
}

.toc-card li.sub-item {
  padding-left: 14px;
}

.toc-card a {
  text-decoration: none;
  color: #4b5563;
  transition: color 0.15s ease;
  display: block;
}

.toc-card a:hover {
  color: #111827;
  font-weight: 500;
}

/* Content Area */
.article-content {
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 16px; /* 🟢 ปรับความโค้งมนให้แมตช์กับสารบัญ */
  padding: 28px 32px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
}

.main-image-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  height: 380px;
  background-color: #f1f5f9;
  margin-bottom: 24px;
}

.main-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.article-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #000000;
  margin-bottom: 20px;
  line-height: 1.35;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 16px;
}

/* WordPress Content */
:deep(.wordpress-content) {
  font-size: 0.925rem;
  line-height: 1.65;
  color: #374151;
}

:deep(.wordpress-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
  display: block;
}

:deep(.wordpress-content h2) {
  font-size: 1.25rem;
  font-weight: 800;
  color: #000000;
  margin-top: 28px;
  margin-bottom: 12px;
  line-height: 1.4;
  scroll-margin-top: 80px;
  border-top: 1px solid #f1f5f9;
  padding-top: 20px;
}

:deep(.wordpress-content h2:first-of-type) {
  border-top: none;
  padding-top: 0;
}

:deep(.wordpress-content h3) {
  font-size: 1.08rem;
  font-weight: 800;
  color: #000000;
  margin-top: 20px;
  margin-bottom: 10px;
  scroll-margin-top: 80px;
}

:deep(.wordpress-content p) {
  margin-bottom: 14px;
  color: #4b5563;
}

:deep(.wordpress-content hr) {
  border: none;
  border-top: 1px solid #f1f5f9;
  margin: 24px 0;
}

:deep(.wordpress-content ul),
:deep(.wordpress-content ol) {
  padding-left: 20px;
  margin-bottom: 18px;
  color: #374151;
}

:deep(.wordpress-content li) {
  margin-bottom: 6px;
  line-height: 1.6;
}

:deep(.wordpress-content a) {
  color: #0284c7;
  text-decoration: underline;
}

/* MORE POSTS Section */
.more-posts-section {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid #e5e7eb;
}

.more-posts-title {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 2.5px;
  color: #111827;
  margin-bottom: 24px;
  text-transform: uppercase;
}

.more-posts-list {
  display: flex;
  flex-direction: column;
}

.more-post-item {
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease;
}

.more-post-item:first-child {
  border-top: 1px solid #f1f5f9;
}

.more-post-item:hover {
  background-color: #fafafa;
}

.post-item-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
}

.post-item-date {
  font-size: 0.75rem;
  color: #9ca3af;
}

.status-container {
  max-width: 500px;
  margin: 100px auto;
  text-align: center;
  padding: 40px;
}

.back-link {
  display: inline-block;
  margin-top: 16px;
  color: #0284c7;
  text-decoration: none;
  font-weight: 600;
}

/* Responsive สำหรับหน้าจอมือถือ/แท็บเล็ต */
@media (max-width: 1024px) {
  .article-detail-container {
    grid-template-columns: 1fr;
  }

  .toc-sidebar {
    width: 100%;
  }

  .toc-card,
  .toc-card.is-fixed {
    position: relative;
    top: 0;
    width: 100%;
  }

  .main-image-wrapper {
    height: 240px;
  }
}
</style>