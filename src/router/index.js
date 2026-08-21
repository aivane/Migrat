import { createRouter, createWebHistory } from 'vue-router'
import { isValidFundId } from '../services/fundinfoApi'
import { updateSeoMeta } from '../utils/seo'
import ArticleDetailView from '../views/ArticleDetailView.vue'
import ArticlesView from '../views/ArticlesView.vue'
import DashboardView from '../views/DashboardView.vue'
import FaqView from '../views/FaqView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import HomeView from '../views/HomeView.vue'
import InsightsView from '../views/InsightsView.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import RegisterView from '../views/RegisterView.vue'
import FundinfoLayout from '../views/fundinfo/FundinfoLayout.vue'
import FeederFundView from '../views/fundinfo/FeederFundView.vue'
import OffshoreFundView from '../views/fundinfo/OffshoreFundView.vue'
import ThaiFundView from '../views/fundinfo/ThaiFundView.vue'
import MixedFundView from '../views/fundinfo/MixedFundView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: 'หน้าหลัก | IDEA FUND',
      description:
        'IDEA FUND แพลตฟอร์มค้นหาและวิเคราะห์ข้อมูลกองทุนรวม และหุ้นไทย-ต่างประเทศ เพื่อการตัดสินใจลงทุนที่มีประสิทธิภาพ',
      keywords: 'หน้าแรก, IDEA FUND, กองทุนรวม, หุ้นไทย, หุ้นต่างประเทศ, การลงทุน',
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: {
      title: 'FUNDINFO ข้อมูลกองทุนและหุ้น | IDEA FUND',
      description:
        'วิเคราะห์ข้อมูลเปรียบเทียบกองทุน ผลตอบแทน หุ้นยอดนิยม การจัดพอร์ต และสถิติกองทุนไทยและต่างประเทศ',
      keywords: 'FUNDINFO, ตารางกองทุน, ผลตอบแทนกองทุน, เปรียบเทียบกองทุน, Thai ETF, Foreign ETF',
    },
  },
  {
    path: '/insights',
    name: 'insights',
    component: InsightsView,
    meta: {
      title: 'IDEAFUND ข้อมูลวิเคราะห์แนวโน้มการลงทุน | IDEA FUND',
      description:
        'เจาะลึกแนวโน้มกองทุน Uptrend, Valuation, Popularity, Theme การลงทุน และ Global Fund Flow ประจำวัน',
      keywords: 'IDEAFUND, Insights, Trend กองทุน, Global Flow, Valuation, Theme กองทุน',
    },
  },
  {
    path: '/articles',
    name: 'articles',
    component: ArticlesView,
    meta: {
      title: 'บทความและบทวิเคราะห์การลงทุน | IDEA FUND',
      description:
        'รวมบทความวิเคราะห์การลงทุน กองทุนรวม หุ้น เทรนด์ตลาดการเงิน และคำแนะนำจากผู้เชี่ยวชาญ',
      keywords: 'บทความการลงทุน, บทวิเคราะห์กองทุน, ข่าวหุ้น, เทรนด์การลงทุน, IDEA FUND Articles',
    },
  },
  {
    path: '/articles/:id',
    name: 'article-detail',
    component: ArticleDetailView,
    props: true,
    meta: {
      title: 'บทวิเคราะห์การลงทุน | IDEA FUND',
      description: 'อ่านบทความวิเคราะห์เจาะลึกข้อมูลกองทุนและการลงทุนบน IDEA FUND',
      keywords: 'บทความวิเคราะห์, กองทุนรวม, บทความการเงิน',
    },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      title: 'เข้าสู่ระบบ | IDEA FUND',
      description: 'เข้าสู่ระบบบัญชีผู้ใช้ IDEA FUND เพื่อเข้าถึงฟีเจอร์การวิเคราะห์กองทุนส่วนตัว',
      keywords: 'เข้าสู่ระบบ, Login, IDEA FUND Login',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: {
      title: 'สมัครสมาชิก | IDEA FUND',
      description: 'สมัครสมาชิกใหม่กับ IDEA FUND เพื่อเริ่มต้นใช้งานเครื่องมือวิเคราะห์การลงทุนฟรี',
      keywords: 'สมัครสมาชิก, Register, Create Account, IDEA FUND',
    },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    meta: {
      title: 'ลืมรหัสผ่าน | IDEA FUND',
      description: 'ขอรีเซ็ตรหัสผ่านสำหรับเข้าใช้งานระบบ IDEA FUND',
      keywords: 'ลืมรหัสผ่าน, Forgot Password, Reset Password',
    },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      title: 'โปรไฟล์ผู้ใช้งาน | IDEA FUND',
      description: 'จัดการข้อมูลส่วนตัวและบัญชีผู้ใช้งานบน IDEA FUND',
      keywords: 'โปรไฟล์, Profile, บัญชีผู้ใช้',
    },
  },
  {
    path: '/Faq',
    name: 'faq',
    component: FaqView,
    meta: {
      title: 'คำถามที่พบบ่อย (FAQ) | IDEA FUND',
      description: 'ตอบคำถามข้อสงสัยการใช้งานระบบ IDEA FUND วิธีการค้นหากองทุน ข้อมูลการสมัครสมาชิก และอื่นๆ',
      keywords: 'FAQ, คำถามที่พบบ่อย, ช่วยเหลือ, การใช้งาน IDEA FUND',
    },
  },
  {
    // Auth Guard scaffold — meta.public marks routes exempt from the future
    // requiresAuth check below; fundinfo is read-only public data today.
    path: '/fundinfo',
    component: FundinfoLayout,
    meta: {
      public: true,
      title: 'FUNDINFO ตามประเภทกองทุน | IDEA FUND',
      description: 'ค้นหาและเปรียบเทียบกองทุนแยกตามประเภท Feeder, Offshore, ไทย และผสม',
      keywords: 'FUNDINFO, กองทุน Feeder, กองทุน Offshore, กองทุนไทย, กองทุนผสม',
    },
    children: [
      { path: '', redirect: { name: 'fundinfo-feeder' } },
      { path: 'feeder', name: 'fundinfo-feeder', component: FeederFundView },
      { path: 'offshore', name: 'fundinfo-offshore', component: OffshoreFundView },
      { path: 'thai', name: 'fundinfo-thai', component: ThaiFundView },
      { path: 'mixed', name: 'fundinfo-mixed', component: MixedFundView },
    ],
  },
  {
    path: '/fundinfo/detail/:id',
    name: 'fundinfo-detail',
    component: () => import('../views/fundinfo/FundInfoDetailView.vue'),
    props: true,
    meta: {
      public: true,
      title: 'รายละเอียดกองทุน | IDEA FUND',
      description: 'ข้อมูลเชิงลึกของกองทุน ผลตอบแทน พอร์ตการลงทุน และค่าธรรมเนียม',
      keywords: 'รายละเอียดกองทุน, ผลตอบแทนกองทุน, พอร์ตกองทุน',
    },
    // Input Validation — reject malformed/malicious :id before the view ever
    // mounts or triggers a store/API call (defense-in-depth with the view's
    // own check and with fundinfoApi's isValidFundId on every request).
    beforeEnter: (to, _from, next) => {
      if (isValidFundId(to.params.id)) {
        next()
      } else {
        next({ name: 'fundinfo-feeder' })
      }
    },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Auth Guard — currently a no-op passthrough (no route sets requiresAuth yet),
// wired up now so gating a future authenticated route only means adding
// `meta: { requiresAuth: true }` to it, no router-wide changes.
router.beforeEach((to) => {
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth)
  if (!requiresAuth) return true

  // Lazy import avoids a hard dependency from the router module on Pinia's
  // active-instance lifecycle at router-creation time.
  return import('../stores/authStore').then(({ useAuthStore }) => {
    const authStore = useAuthStore()
    if (authStore.isAuthenticated) return true
    return { name: 'login', query: { redirect: to.fullPath } }
  })
})

// Navigation Guard สำหรับอัปเดต SEO Meta Tags ตามหน้า
router.afterEach((to) => {
  if (to.meta) {
    updateSeoMeta({
      title: to.meta.title,
      description: to.meta.description,
      keywords: to.meta.keywords,
      ogTitle: to.meta.title,
      ogDescription: to.meta.description,
    })
  }
})
