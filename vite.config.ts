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
  build: {
    chunkSizeWarningLimit: 800,
    // ===== 关键：禁用自动 modulePreload =====
    // vite 默认给所有 async chunk 加 <link rel="modulepreload">
    // xgplayer (554KB) 只在 Play 路由用 — 首页预拉纯浪费
    // 我们在 transformIndexHtml 里手动控制只预加载 vue-core
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vconsole')) return 'vconsole'          // 独立 async chunk
            if (id.includes('xgplayer')) return 'xgplayer'          // 独立 async chunk，Play 路由按需加载
            if (id.includes('lucide')) return 'lucide'
            if (id.includes('vue') || id.includes('vue-router')) return 'vue-core'
          }
        },
      },
    },
  },
})
