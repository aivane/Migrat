import { createRouter, createWebHistory } from 'vue-router'
import { isValidFundId } from '../services/fundinfoApi'
import ArticleDetailView from '../views/ArticleDetailView.vue'
import ArticlesView from '../views/ArticlesView.vue'
import DashboardView from '../views/DashboardView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import HomeView from '../views/HomeView.vue'
import InsightsView from '../views/InsightsView.vue'
import LoginView from '../views/LoginView.vue'
import ProfileView from '../views/ProfileView.vue'
import RegisterView from '../views/RegisterView.vue'
import FaqView from '../views/FaqView.vue'
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
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
  },
  {
    path: '/insights',
    name: 'insights',
    component: InsightsView,
  },
  {
    path: '/articles',
    name: 'articles',
    component: ArticlesView,
  },
  {
    path: '/articles/:id',
    name: 'article-detail',
    component: ArticleDetailView,
    props: true,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
  },
  {
    path: '/Faq',
    name: 'faq',
    component: FaqView,
  },
  {
    // Auth Guard scaffold — meta.public marks routes exempt from the future
    // requiresAuth check below; fundinfo is read-only public data today.
    path: '/fundinfo',
    component: FundinfoLayout,
    meta: { public: true },
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
    meta: { public: true },
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
