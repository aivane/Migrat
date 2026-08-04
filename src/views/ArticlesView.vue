<template>
    <div class="articles-page-wrapper">
        <div class="articles-container">
            
            <!-- 1. Header ด้านบน -->
            <div class="page-header">
                <h1 class="page-title">บทวิเคราะห์กองทุนและข่าวสารล่าสุด</h1>
                <p class="page-subtitle">ติดตามเนื้อหาเกี่ยวกับการลงทุน กองทุนรวม และข่าวสารเกี่ยวกับการลงทุนล่าสุด</p>
            </div>

            <!-- 2. Featured Banner บทความไฮไลท์ -->
            <div v-if="featuredArticle" class="featured-banner">
                <div class="featured-image-col">
                    <img :src="featuredArticle.thumbnail" :alt="featuredArticle.title" @error="handleImgError" />
                </div>
                <div class="featured-content-col">
                    <h2 class="featured-title">{{ featuredArticle.title }}</h2>
                    <p class="featured-excerpt">{{ featuredArticle.excerpt }}</p>
                    <router-link :to="'/articles/' + featuredArticle.id" class="featured-btn">
                        อ่านบทความเต็ม <span class="arrow">→</span>
                    </router-link>
                </div>
            </div>

            <!-- 3. ปุ่มเลือกหมวดหมู่ (เรียงตามภาพ) -->
            <div class="category-filters">
                <button 
                    v-for="cat in categories" 
                    :key="cat.id"
                    :class="['filter-btn', { active: selectedCategory === cat.id }]" 
                    @click="changeCategory(cat.id)"
                >
                    {{ cat.name }}
                </button>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
                กำลังโหลดข้อมูลบทความ...
            </div>

            <!-- 4. Articles Grid (ไม่มีตัวอักษรซ้อนหน้ารูป) -->
            <div v-else-if="paginatedArticles.length > 0" class="articles-grid">
                <article v-for="item in paginatedArticles" :key="item.id" class="article-card">
                    <router-link :to="'/articles/' + item.id" class="card-link">
                        <div class="card-image-wrapper">
                            <img :src="item.thumbnail" :alt="item.title" loading="lazy" @error="handleImgError" />
                        </div>

                        <div class="card-body">
                            <h3 class="card-title">{{ item.title }}</h3>
                            <p class="card-excerpt">{{ item.excerpt }}</p>
                            <span v-if="item.date" class="card-date">{{ item.date }}</span>
                        </div>
                    </router-link>
                </article>
            </div>

            <!-- No Data State -->
            <div v-else class="no-data">
                ไม่พบบทความในหมวดหมู่นี้
            </div>

            <!-- 5. Pagination Bar ด้านล่าง -->
            <div v-if="totalPages > 1" class="pagination-wrapper">
                <button 
                    class="nav-page-btn prev-btn" 
                    :style="{ visibility: currentPage > 1 ? 'visible' : 'hidden' }"
                    @click="currentPage--"
                >
                    ← Previous Page
                </button>

                <div class="pagination-numbers">
                    <template v-for="(item, idx) in paginationRange" :key="idx + '-' + item">
                        <span v-if="item === '...'" class="page-dots">…</span>
                        <button 
                            v-else
                            :class="['page-num', { active: currentPage === item }]"
                            @click="currentPage = item"
                        >
                            {{ item }}
                        </button>
                    </template>
                </div>

                <button 
                    class="nav-page-btn next-btn" 
                    :style="{ visibility: currentPage < totalPages ? 'visible' : 'hidden' }"
                    @click="currentPage++"
                >
                    Next Page →
                </button>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
    ARTICLE_CATEGORY_TABS,
    getArticles,
    getFeaturedArticle,
} from '../services/articlesApi'

const loading = ref(true)
const paginatedArticles = ref([])
const featuredArticle = ref(null)
const totalPages = ref(1)
const currentPage = ref(1)
const itemsPerPage = 6

// เรียงลำดับหมวดหมู่ตรงตามรูปภาพ 100% -> แต่ละแท็บผูกกับ WordPress category id จริง
const categories = ref(ARTICLE_CATEGORY_TABS)
const selectedCategory = ref('all')

// สร้างเลขหน้าแบบย่อ เช่น [1, 2, 3, '...', 7] แทนที่จะโชว์ทุกหน้าเรียงยาว
// delta = ระยะหน้าที่จะโชว์รอบ ๆ หน้าปัจจุบัน (นอกเหนือจากหน้าแรก/หน้าสุดท้ายที่โชว์เสมอ)
const paginationRange = computed(() => {
    const total = totalPages.value
    const current = currentPage.value
    const delta = 2
    const range = []
    const withDots = []
    let last

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i)
        }
    }

    range.forEach((page) => {
        if (last !== undefined) {
            if (page - last === 2) {
                // ห่างกันแค่ 1 หน้า -> ใส่หน้านั้นไปเลยดีกว่าใส่ "..." (เช่น 1 2 3 แทน 1 ... 3)
                withDots.push(last + 1)
            } else if (page - last > 1) {
                withDots.push('...')
            }
        }
        withDots.push(page)
        last = page
    })

    return withDots
})

const handleImgError = (event) => {
    event.target.src = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80'
}

const changeCategory = (catId) => {
    selectedCategory.value = catId
    currentPage.value = 1
}

function activeCategoryId() {
    const tab = categories.value.find((item) => item.id === selectedCategory.value)
    return tab ? tab.categoryId : null
}

async function fetchArticles() {
    loading.value = true

    try {
        const result = await getArticles({
            page: currentPage.value,
            perPage: itemsPerPage,
            categoryId: activeCategoryId(),
        })

        paginatedArticles.value = result.articles
        totalPages.value = result.totalPages
    } catch (err) {
        console.error('Error loading posts:', err)
        paginatedArticles.value = []
        totalPages.value = 1
    } finally {
        loading.value = false
    }
}

watch([selectedCategory, currentPage], fetchArticles)

onMounted(async () => {
    fetchArticles()
    featuredArticle.value = await getFeaturedArticle().catch(() => null)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');

.articles-page-wrapper {
    font-family: 'Kanit', sans-serif;
    background-color: #ffffff;
    color: #111827;
    min-height: 100vh;
    padding: 35px 0 60px 0;
}

.articles-container {
    max-width: 980px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Page Header */
.page-header {
    text-align: center;
    margin-bottom: 28px;
}

.page-title {
    font-size: 1.8rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 6px;
}

.page-subtitle {
    font-size: 0.88rem;
    color: #6b7280;
    margin: 0;
}

/* Featured Banner */
.featured-banner {
    display: grid;
    grid-template-columns: 310px 1fr;
    gap: 22px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 16px;
    background: #ffffff;
    margin-bottom: 30px;
    align-items: center;
}

.featured-image-col {
    width: 100%;
    height: 180px;
    border-radius: 8px;
    overflow: hidden;
    background: #1e293b;
}

.featured-image-col img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.featured-content-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.featured-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 10px;
    line-height: 1.35;
}

.featured-excerpt {
    font-size: 0.82rem;
    color: #4b5563;
    line-height: 1.55;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.featured-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    background-color: #111827;
    color: #ffffff;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s ease;
}

.featured-btn:hover {
    background-color: #1f2937;
}

/* Category Filter Pills */
.category-filters {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 30px;
    flex-wrap: wrap;
}

.filter-btn {
    padding: 6px 22px;
    border-radius: 999px;
    border: 1px solid #374151;
    background: #ffffff;
    color: #1f2937;
    font-family: 'Kanit', sans-serif;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}

.filter-btn.active {
    background: #374151;
    color: #ffffff;
    border-color: #374151;
}

/* Article Grid Layout */
.articles-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.article-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
}

.card-link {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.card-image-wrapper {
    width: 100%;
    height: 150px;
    border-radius: 6px;
    overflow: hidden;
    background: #1e293b;
}

.card-image-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.card-body {
    padding: 10px 2px 2px 2px;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
}

.card-title {
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 6px;
    color: #1f2937;
    line-height: 1.35;
}

.card-excerpt {
    font-size: 0.78rem;
    color: #6b7280;
    line-height: 1.45;
    margin-bottom: 10px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card-date {
    font-size: 0.74rem;
    color: #9ca3af;
    margin-top: auto;
}

/* Pagination Bar */
.pagination-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 32px;
    padding: 0 4px;
}

.nav-page-btn {
    background: none;
    border: none;
    font-family: 'Kanit', sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: #111827;
    cursor: pointer;
}

.pagination-numbers {
    display: flex;
    gap: 8px;
    margin: 0 auto;
}

.page-num {
    background: none;
    border: none;
    font-family: 'Kanit', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    color: #111827;
    cursor: pointer;
    padding: 2px 6px;
}

.page-num.active {
    color: #0284c7;
}

.page-dots {
    font-family: 'Kanit', sans-serif;
    font-size: 0.9rem;
    color: #9ca3af;
    padding: 2px 4px;
    user-select: none;
}

.loading-state,
.no-data {
    text-align: center;
    padding: 60px 0;
    color: #64748b;
}

@media (max-width: 820px) {
    .featured-banner {
        grid-template-columns: 1fr;
    }
    .featured-image-col {
        height: 200px;
    }
    .articles-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 560px) {
    .articles-grid {
        grid-template-columns: 1fr;
    }
}
</style>