import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const fundApiTarget = 'https://isabella-hagiologic-rolland.ngrok-free.dev'
const fundBackendTarget = 'https://unexcusable-depreciatingly-lieselotte.ngrok-free.dev'

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
    },
  },
})
