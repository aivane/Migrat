import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env
  const env = loadEnv(mode, process.cwd(), '')

  // กำหนด Target URL สำหรับ Proxy โดยอ่านจาก .env ก่อน ถ้าไม่มีจะใช้ค่า Default
  const fundApiTarget = env.VITE_PROXY_FUND_API || 'https://isabella-hagiologic-rolland.ngrok-free.dev'
  const fundBackendTarget = env.VITE_PROXY_FUND_BACKEND || 'https://unexcusable-depreciatingly-lieselotte.ngrok-free.dev'
  const wpSiteTarget = env.VITE_PROXY_WP_SITE || 'https://ideatradefund.com'

  return {
    plugins: [vue()],
    server: {
      proxy: {
        // Fundinfo direct API — keeps the ngrok origin server-side in development,
        // avoiding CORS exposure and preserving same-origin request semantics.
        '/api/fund': {
          target: fundApiTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        // Proxy สำหรับ Recon / Fund / Dashboard / Insights API
        '/api/recon/v2': {
          target: fundApiTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        // Proxy สำหรับ Auth API
        '/api/backend': {
          target: fundBackendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/backend/, ''),
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        // Proxy สำหรับ WordPress AJAX Handler
        '/wp-admin/admin-ajax.php': {
          target: wpSiteTarget,
          changeOrigin: true,
          secure: false,
        },
        // Proxy สำหรับ WordPress REST API
        '/wp-json': {
          target: wpSiteTarget,
          changeOrigin: true,
          secure: false,
        },
        // Proxy สำหรับรูปภาพ / Media ใน WordPress uploads
        '/wp-content': {
          target: wpSiteTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
