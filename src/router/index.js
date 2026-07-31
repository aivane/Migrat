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
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})