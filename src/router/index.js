import { createRouter, createWebHistory } from 'vue-router'
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
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
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
