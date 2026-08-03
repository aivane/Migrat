<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getFaqList } from '../services/faqApi'

const state = reactive({
  activeCategory: 'all',
  search: '',
  faqs: [],
  categories: [],
  openIds: new Set(),
})

const loading = reactive({ page: true })
const errorMessage = ref('')

const categoryChips = computed(() => [
  { key: 'all', label: 'ทั้งหมด' },
  ...state.categories.map((category) => ({ key: category.slug, label: category.name })),
])

const filteredFaqs = computed(() => {
  const keyword = state.search.trim().toLowerCase()

  return state.faqs.filter((item) => {
    const matchesCategory = state.activeCategory === 'all' || item.category === state.activeCategory
    const matchesKeyword =
      !keyword ||
      item.question.toLowerCase().includes(keyword) ||
      item.answer.toLowerCase().includes(keyword)

    return matchesCategory && matchesKeyword
  })
})

function setCategory(key) {
  state.activeCategory = key
}

function isOpen(id) {
  return state.openIds.has(id)
}

function toggleFaq(id) {
  if (state.openIds.has(id)) {
    state.openIds.delete(id)
  } else {
    state.openIds.add(id)
  }
}

async function loadFaqs() {
  loading.page = true
  errorMessage.value = ''

  try {
    const { faqs, categories } = await getFaqList()
    state.faqs = faqs
    state.categories = categories
    state.openIds = new Set()
  } catch (error) {
    errorMessage.value = 'โหลดข้อมูลคำถามที่พบบ่อยไม่สำเร็จ'
    console.error(error)
  } finally {
    loading.page = false
  }
}

onMounted(loadFaqs)
</script>

<template>
  <main id="faq-app" class="faq-page">
    <section class="faq-hero">
      <h1>Frequently Asked Questions</h1>
      <p class="faq-hero-sub">รวมคำถามที่พบบ่อยเกี่ยวกับการลงทุนในกองทุนไทยและต่างประเทศ</p>

      <div class="faq-categories">
        <button
          v-for="category in categoryChips"
          :key="category.key"
          class="faq-chip"
          :class="{ on: state.activeCategory === category.key }"
          @click="setCategory(category.key)"
        >
          {{ category.label }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>

    <section class="faq-list">
      <p v-if="loading.page" class="faq-empty">กำลังโหลดคำถามที่พบบ่อย...</p>
      <p v-else-if="!filteredFaqs.length" class="faq-empty">ไม่พบคำถามที่ตรงกับหมวดหมู่หรือคำค้นหานี้</p>

      <article
        v-for="item in filteredFaqs"
        v-else
        :key="item.id"
        class="faq-item"
        :class="{ expanded: isOpen(item.id) }"
      >
        <button class="faq-q-row" @click="toggleFaq(item.id)">
          <span class="faq-q-icon">?</span>
          <span class="faq-q-text">{{ item.question }}</span>
          <span class="faq-toggle-icon">{{ isOpen(item.id) ? '−' : '+' }}</span>
        </button>

        <div v-show="isOpen(item.id)" class="faq-a-row">
          <svg
            class="faq-a-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1e293b"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div class="faq-a-text" v-html="item.answer"></div>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap');

.faq-page,
.faq-page * {
  font-family: 'Kanit', sans-serif;
  box-sizing: border-box;
}
.faq-page {
  width: 100%;
  max-width: 0 auto;
  margin: 0 auto;
  padding: 40px 20px 80px;
  background-color: #ffffff;
  font-family: 'Noto Sans Thai', 'Segoe UI', -apple-system, sans-serif;
  color: #0f172a;
}

.faq-hero {
  text-align: center;
  margin-bottom: 32px;
}

.faq-hero h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.faq-hero-sub {
  margin: 10px 0 28px;
  font-size: 15px;
  color: #475569;
}

/* Category Chips */
.faq-categories {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.faq-chip {
  padding: 8px 24px;
  border-radius: 999px;
  border: 1.5px solid #333333;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.faq-chip:hover {
  background: #f8fafc;
}

.faq-chip.on {
  background: #333333;
  border-color: #333333;
  color: #ffffff;
}

.alert {
  max-width: 640px;
  margin: 0 auto 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 14px;
  text-align: center;
}

/* FAQ Item List */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-empty {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
}

/* FAQ Card styling */
.faq-item {
  border-radius: 999px;
  background: #edf4fe;
  border: 1px solid transparent;
  transition: all 0.2s ease-in-out;
  overflow: hidden;
}

/* เมื่อเปิดคำตอบ: ปรับกรอบเป็นสี่เหลี่ยมมุมมน + พื้นหลังคำตอบขาว + มีเส้นขอบ */
.faq-item.expanded {
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #dbeafe;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.faq-q-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  background: #edf4fe;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  border-radius: 999px;
  transition: border-radius 0.2s ease;
}

.faq-item.expanded .faq-q-row {
  border-radius: 15px 15px 0 0;
}

.faq-q-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #1e293b;
  color: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.faq-q-text {
  flex: 1;
  font-size: 18px;
  font-weight: 500;
  color: #1e293b;
}

.faq-toggle-icon {
  flex-shrink: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  width: 20px;
  text-align: center;
}

/* Answer Section inside Card */
.faq-a-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 22px;
  background: #ffffff;
  color: #334155;
  font-size: 16px;
  line-height: 1.6;
}

.faq-a-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.faq-a-text {
  flex: 1;
  color: #334155;
}

.faq-a-text :deep(p) {
  margin: 0 0 8px;
}

.faq-a-text :deep(p:last-child) {
  margin-bottom: 0;
}

/* Responsive Styles */
@media (max-width: 640px) {
  .faq-page {
    padding: 24px 12px 40px;
  }

  .faq-hero h1 {
    font-size: 28px;
  }

  .faq-item.expanded {
    border-radius: 16px;
  }

  .faq-q-text {
    font-size: 14px;
  }
}
</style>