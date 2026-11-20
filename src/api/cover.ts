// 封面 URL 改写 —— 把 changzhang CDN 的 poster 直链改写成走 /api-proxy 的缩图路由
// 其他 URL 原样返回（非 poster、非 changzhang CDN、空值）
// App 原生模式下没有同源 server.js，直连用户 IP 最快，不改写
const POSTER_RE = /^https?:\/\/p1\.czzyplay\.com\/images\/\d+\/poster$/

export function getCoverUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (!POSTER_RE.test(url)) return url
  if (detectAppMode()) return url
  // 去掉协议域名，保留路径，加 cover=1 让 server.js 进入缩图分支
  const path = url.replace(/^https?:\/\/p1\.czzyplay\.com/, '')
  return `/api-proxy/p1.czzyplay.com${path}?cover=1`
}

function detectAppMode(): boolean {
  if (typeof window === 'undefined') return false
  if ((window as any).__TAURI__) return true
  try {
    const C = (window as any).Capacitor
    if (C?.isNativePlatform?.()) return true
  } catch {}
  const origin = window.location.origin || ''
  if (origin.includes('tauri.localhost')) return true
  if (origin === 'https://localhost' || origin === 'http://localhost') {
    if ((window as any).Capacitor) return true
  }
  const proto = window.location.protocol || ''
  if (proto === 'tauri:' || proto === 'capacitor:' || proto === 'file:') return true
  return false
}
