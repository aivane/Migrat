import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const fundApiTarget = 'https://isabella-hagiologic-rolland.ngrok-free.dev'
const fundBackendTarget = 'https://unexcusable-depreciatingly-lieselotte.ngrok-free.dev'
<<<<<<< HEAD
=======
const wpSiteTarget = 'https://ideatradefund.com'
>>>>>>> Faq

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api/recon/v2': {
        target: fundApiTarget,
        changeOrigin: true,
        secure: false,
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
      },
      '/api/backend': {
        target: fundBackendTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/backend/, ''),
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
      },
      '/wp-admin/admin-ajax.php': {
        target: wpSiteTarget,
        changeOrigin: true,
        secure: false,
      },
      // เก็บ /wp-json ไว้เผื่อยังต้องสลับกลับไปโหมด 'api' (legacy REST) ชั่วคราว
      '/wp-json': {
        target: wpSiteTarget,
        changeOrigin: true,
        secure: false,
      },
      // รูปภาพ/ไฟล์ media (thumbnail, รูปในเนื้อหาบทความ) ต้องผ่าน proxy ตัวนี้ด้วย
      // ไม่งั้น <img src="https://ideatradefund.com/wp-content/uploads/...">
      // จะยิงตรงจาก browser ไปที่โดเมนจริงเลย ซึ่งเจอปัญหา cert เหมือนกับ
      // endpoint อื่น ๆ (ที่ต้องปิด secure/sslverify ไว้) -> ทำให้รูปพังเป็น
      // net::ERR_CERT_AUTHORITY_INVALID ทั้งหมด ต้องคู่กับฝั่ง PHP ที่ตัด
      // host ออกจาก URL รูปให้เหลือ path เดียว (relative) ก่อนส่งกลับมาด้วย
      '/wp-content': {
        target: wpSiteTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
