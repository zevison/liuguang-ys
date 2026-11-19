// 极简 Service Worker — 让浏览器认这个网站是 PWA
// 不做缓存策略，保持简单
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
self.addEventListener('fetch', () => { /* 不拦截，保持网络请求原样 */ })
