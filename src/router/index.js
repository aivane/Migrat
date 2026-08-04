import { createRouter, createWebHistory } from 'vue-router'
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
    path: '/fundinfo',
    component: FundinfoLayout,
    children: [
      { path: '', redirect: { name: 'fundinfo-feeder' } },
      { path: 'feeder', name: 'fundinfo-feeder', component: FeederFundView },
      { path: 'offshore', name: 'fundinfo-offshore', component: OffshoreFundView },
      { path: 'thai', name: 'fundinfo-thai', component: ThaiFundView },
      { path: 'mixed', name: 'fundinfo-mixed', component: MixedFundView },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
