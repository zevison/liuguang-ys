// ===== 全局 Patch：xgplayer mobile 插件硬编码 if (!sniffer.os.isIos) skip volume =====
// sniffer.os 是 getter（每次返回新对象），必须用 Object.defineProperty 覆盖 getter
import sniffer from 'xgplayer/es/utils/sniffer.js'
const desc = Object.getOwnPropertyDescriptor(sniffer, 'os')
if (desc && typeof desc.get === 'function' && desc.get().isIos) {
  const origGet = desc.get.bind(sniffer)
  Object.defineProperty(sniffer, 'os', {
    configurable: true,
    enumerable: true,
    get() {
      const o = origGet()
      o.isIos = false   // 关键：让 mobile 插件 executeMove case 2（音量）分支也能跑
      return o
    },
  })
  try { console.log('[bootstrap] sniffer.os getter patched ✅') } catch {}
}

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// 移动端调试：URL 带 ?vconsole=1 时启用 vConsole
if (typeof window !== 'undefined' && window.location.search.includes('vconsole=1')) {
  import('vconsole').then(m => {
    const VConsole = m.default
    new VConsole({ theme: 'dark' })
  })
}

const app = createApp(App)
app.use(router)
app.mount('#app')

// 注册极简 Service Worker → PWA 支持
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
