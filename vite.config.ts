import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import * as dns from 'node:dns'

// 强制 Node.js DNS 优先 IPv4（很多站长 IPv6 不可达导致 ETIMEDOUT）
dns.setDefaultResultOrder('ipv4first')

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api-proxy': {
        target: 'https://example.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ===== 构建优化 =====
  // 1. 手动切分大依赖，避免 xgplayer/lucide 被打进 Play chunk 后首页也跟着加载
  // 2. manualChunks 让 vue / vue-router 独立抽离 → 多页面复用
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-core': ['vue', 'vue-router'],
          'lucide': ['lucide-vue-next'],
          'xgplayer': ['xgplayer', 'xgplayer-hls'],
        },
      },
    },
  },
})
