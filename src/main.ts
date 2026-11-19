// ===== 全局设备检测 =====
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : ''
export const IS_HARMONYOS = /HarmonyOS|OpenHarmony/i.test(UA)
export const IS_IOS = /iPhone|iPad|iPod/.test(UA)
export const IS_TABLET = /iPad|Android.*Tablet|HarmonyOS.*Tablet/i.test(UA) ||
  (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) >= 768 && Math.max(window.innerWidth, window.innerHeight) >= 1024)

// ===== 全局 Patch：xgplayer mobile 插件硬编码 if (!sniffer.os.isIos) skip volume =====
// sniffer.os 是 getter（每次返回新对象），必须用 Object.defineProperty 覆盖 getter
import sniffer from 'xgplayer/es/utils/sniffer.js'
const desc = Object.getOwnPropertyDescriptor(sniffer, 'os')
if (desc && typeof desc.get === 'function') {
  const origGet = desc.get.bind(sniffer)
  Object.defineProperty(sniffer, 'os', {
    configurable: true,
    enumerable: true,
    get() {
      const o = origGet()
      // 关键：任何非 iOS 设备都让 mobile 插件音量分支跑（包括鸿蒙/安卓平板/桌面）
      o.isIos = IS_IOS
      return o
    },
  })
  try { console.log('[bootstrap] sniffer.os getter patched ✅', { IS_IOS, IS_HARMONYOS, IS_TABLET }) } catch {}
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

// ===== Capacitor Keyboard 插件初始化 =====
// 关键：软键盘弹出时监听 resize，避免 WebView 被强制 adjustPan 导致输入框/IME 异常
// 注意：resizeOnFullScreen=true 让 WebView 自动 resize（adjustResize 模式）
// 这样 input 不会被键盘遮挡，composition 事件也更稳定
async function initKeyboard() {
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const { Keyboard } = await import('@capacitor/keyboard')
      Keyboard.addListener('keyboardWillShow', (info: any) => {
        try { console.log('[Keyboard] will show, height:', info?.keyboardHeight) } catch {}
      })
      Keyboard.addListener('keyboardWillHide', () => {
        try { console.log('[Keyboard] will hide') } catch {}
      })
      console.log('[bootstrap] Capacitor Keyboard plugin initialized ✅')
    }
  } catch (e: any) {
    try { console.warn('[bootstrap] Keyboard plugin init skipped:', e?.message) } catch {}
  }
}
initKeyboard()

// ===== 全局 Composition 事件保护 =====
// Android/WebView 中文 IME 候选词选择依赖 compositionstart → compositionend 事件
// 如果这期间有任何全局 re-render 或 DOM 操作打断，候选词就无法确认
// Vue 3 v-model 已内置 composition 保护，但我们加一层全局标记供其他逻辑使用
;(window as any).__IS_COMPOSING__ = false
window.addEventListener('compositionstart', () => {
  ;(window as any).__IS_COMPOSING__ = true
})
window.addEventListener('compositionend', () => {
  ;(window as any).__IS_COMPOSING__ = false
  // compositionend 后强制触发一次 input 事件（某些 WebView 上 v-model 可能漏同步）
  const active = document.activeElement as HTMLInputElement | null
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    try { active.dispatchEvent(new Event('input', { bubbles: true })) } catch {}
  }
})

// ===== HarmonyOS video polyfill =====
// HarmonyOS NEXT WebView 基于 Chromium 130+，基本原生兼容
// 旧版鸿蒙可能需要 webkit 前缀兜底
if (IS_HARMONYOS) {
  try {
    const origCreateElement = document.createElement.bind(document)
    document.createElement = function(tagName: string) {
      const el = origCreateElement(tagName)
      if (tagName.toLowerCase() === 'video') {
        try {
          ;(el as any).playsInline = true
          ;(el as any).webkitPlaysInline = true
          ;(el as any).setAttribute?.('playsinline', '')
          ;(el as any).setAttribute?.('webkit-playsinline', '')
        } catch {}
      }
      return el
    }
    console.log('[bootstrap] HarmonyOS video polyfill injected ✅')
  } catch {}
}
