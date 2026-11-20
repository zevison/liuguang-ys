/**
 * 映界 server — 播放加速版
 *  - serve 静态 dist/
 *  - 代理 API + m3u8 + ts 分片 → 全链路内存缓存
 *  - Node 20 fetch 自带 undici（keep-alive + DNS 缓存）
 */
import http from 'node:http'
import zlib from 'node:zlib'
import * as dns from 'node:dns'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import got from 'got'

// 可选：Sharp 图片压缩（VPS 端把封面 213KB JPG → ~40KB WebP，加载快 5×）
let sharp = null
try { sharp = (await import('sharp')).default } catch {}

dns.setDefaultResultOrder('ipv4first')

const PORT = process.env.PORT || 8000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = fs.existsSync(path.join(__dirname, 'assets')) ? __dirname : path.join(__dirname, 'dist')
const PROXY_TIMEOUT_MS = 30000

// ===== gzip 中间件 =====
function gzipWrite(res, status, headers, body) {
  const acceptEnc = res.req?.headers['accept-encoding'] || ''
  if (typeof body === 'string') body = Buffer.from(body, 'utf-8')
  if (Buffer.isBuffer(body) && acceptEnc.includes('gzip') && body.length > 1024) {
    const compressed = zlib.gzipSync(body)
    headers = { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', 'Content-Length': compressed.length }
    res.writeHead(status, headers)
    res.end(compressed)
    return
  }
  if (Buffer.isBuffer(body)) headers = { ...headers, 'Content-Length': body.length }
  res.writeHead(status, headers)
  res.end(body)
}

// ---------- 分级内存缓存 ----------
// m3u8 manifest：15s（短 TTL，playlist 可能更新）
// ts 分片：60s（分片 URL 稳定，缓存长一点）
// JSON API：60s（搜索结果、详情）
// 图片：30min（封面 URL 几乎不变）
const CACHE = {
  m3u8:  { map: new Map(), ttl: 15_000,           maxSize: 256 * 1024,       maxEntries: 100 },
  ts:    { map: new Map(), ttl: 60_000,           maxSize: 10 * 1024 * 1024, maxEntries: 80  },
  json:  { map: new Map(), ttl: 60_000,           maxSize: 512 * 1024,       maxEntries: 100 },
  image: { map: new Map(), ttl: 30 * 60_000,      maxSize: 8 * 1024 * 1024,  maxEntries: 500 },
}

function tryCache(kind, key) {
  const c = CACHE[kind].map.get(key)
  if (!c) return null
  if (Date.now() > c.expireAt) { CACHE[kind].map.delete(key); return null }
  return c
}
function putCache(kind, key, buf, headers) {
  const cfg = CACHE[kind]
  if (buf.length > cfg.maxSize) return
  cfg.map.set(key, { buf, headers, expireAt: Date.now() + cfg.ttl })
  if (cfg.map.size > cfg.maxEntries) {
    const firstKey = cfg.map.keys().next().value
    cfg.map.delete(firstKey)
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
}

function serveStatic(req, res) {
  let urlPath = (req.url || '/').split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'
  let filePath = path.join(DIST, urlPath)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }
  const ext = path.extname(filePath)
  const isHtml = ext === '.html'
  const stat = fs.statSync(filePath)
  const buf = fs.readFileSync(filePath)

  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isHtml ? 'no-store, no-cache, must-revalidate' : 'public, max-age=86400, immutable',
    'ETag': `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
  }
  if (isHtml) { headers['Pragma'] = 'no-cache'; headers['Expires'] = '0' }

  // ETag 304
  const ifNoneMatch = req.headers['if-none-match']
  if (ifNoneMatch && ifNoneMatch.includes(headers['ETag'])) {
    res.writeHead(304, { 'ETag': headers['ETag'], 'Cache-Control': headers['Cache-Control'] })
    res.end()
    return
  }

  gzipWrite(res, 200, headers, buf)
}

// m3u8 重写：把 ts 分片 + 二级 m3u8 全部改写成走 /api-proxy 代理
function rewriteM3u8(content, incomingHost) {
  let text = content.toString('utf-8')

  // 极速源 maowushi CDN 反爬：返回 ASCII 码数字编码（35,69,88,84,#EXTM3U）
  // 如果内容全是逗号分隔的 ASCII 数字，先解码
  if (/^\s*\d+(\s*,\s*\d+)*\s*$/.test(text.trim())) {
    try {
      text = text.split(',').map(s => String.fromCharCode(parseInt(s.trim()))).join('')
    } catch { /* 解码失败，保持原样 */ }
  }

  const lines = text.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line

    // Case 1: 绝对 URL (https://host/path.ts 或 .m3u8)
    const absMatch = line.match(/^(https?:\/\/)([^/\r\n]+)(\/[^\r\n]+)$/)
    if (absMatch) {
      const [, , host, path] = absMatch
      return `/api-proxy/${host}${path}`
    }

    // Case 2: 以 / 开头的相对路径（ts 或 m3u8）
    if (trimmed.startsWith('/')) {
      return `/api-proxy/${incomingHost}${trimmed}`
    }

    // Case 3: 不带 / 的相对路径
    return `/api-proxy/${incomingHost}/${trimmed}`
  })
  return Buffer.from(lines.join('\n'), 'utf-8')
}

// m3u8 后台预取前 N 个 ts 分片到内存缓存
const PREFETCH_TS_COUNT = 3

function parseAndPrefetchTs(m3u8Content, host, pathname) {
  try {
    const lines = m3u8Content.toString('utf-8').split('\n')
    const tsUrls = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      if (trimmed.endsWith('.ts')) tsUrls.push(trimmed)
      if (tsUrls.length >= PREFETCH_TS_COUNT) break
    }
    if (!tsUrls.length) return

    for (const rawUrl of tsUrls) {
      // 从 rewriteM3u8 改写成的 /api-proxy/<host><path> 里提取真正的 CDN URL
      let url = rawUrl
      if (url.startsWith('/api-proxy/')) {
        const m = url.match(/^\/api-proxy\/([^/]+)(\/.+)$/)
        if (m) url = `https://${m[1]}${m[2]}`
      } else if (!url.startsWith('http')) {
        // 相对路径：用 m3u8 CDN 做 base
        const m3u8Url = new URL('https://' + host + pathname)
        const baseDir = m3u8Url.pathname.substring(0, m3u8Url.pathname.lastIndexOf('/') + 1)
        url = `https://${m3u8Url.host}${baseDir}${rawUrl}`
      }

      // 从完整 URL 计算我们代理缓存用的 key
      const u = new URL(url)
      const cacheKey = u.host + u.pathname + u.search

      try {
        got.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
            'Referer': 'https://' + host + '/',
          },
          responseType: 'buffer',
          timeout: { request: 5000 },
          retry: { limit: 0 },
        }).then(async r => {
          if (r.statusCode !== 200) return
          const buf = r.body
          putCache('ts', cacheKey, buf, {
            'Content-Type': 'video/mp2t',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          })
        }).catch(() => {})
      } catch {}
    }
  } catch {}
}

function detectKind(pathname) {
  const p = pathname.toLowerCase()
  if (p.endsWith('.m3u8')) return 'm3u8'
  if (p.endsWith('.ts'))   return 'ts'
  if (p.includes('/api.php/provide/vod')) return 'json'
  // 有图片扩展名：.jpg/.png/.webp 等
  if (/\.(jpe?g|png|webp|gif|avif|svg|bmp|ico|tiff?)$/.test(p)) return 'image'
  // 无扩展名但路径暗示是图片：站长 poster 直链 /images/{id}/poster
  if (/\/images?\/\d+\/(poster|thumb|cover)$/.test(p)) return 'image'
  return null
}

async function proxyApi(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  try {
    const rest = (req.url || '/').replace(/^\/api-proxy\//, '')
    const slashIdx = rest.indexOf('/')
    const host = slashIdx === -1 ? rest : rest.slice(0, slashIdx)
    const rawPath = slashIdx === -1 ? '/' : rest.slice(slashIdx)
    if (!host) { res.writeHead(400); res.end('bad url'); return }
    const targetUrl = 'https://' + host + rawPath

    const cacheKey = host + rawPath
    const kind = detectKind(rawPath)

    if (kind) {
      const cached = tryCache(kind, cacheKey)
      if (cached) {
        res.writeHead(200, cached.headers)
        res.end(cached.buf)
        return
      }
    }

    // JSON API 请求 → 用 Node 原生 fetch（快）
    // CDN 请求 (m3u8/ts/image) → 用 got（基于 libcurl，TLS 指纹和 curl 相同，CDN 放行）
    const isApiJson = !kind && rawPath.includes('/api.php/')

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://' + host + '/',
      'Connection': 'keep-alive',
    }

    // 透传客户端 Range 头 —— HLS.js 快进必须用 Range 分片
    // 某些 CDN（如 xgplay3.jimxtc.com）不支持 Range 会返回 402/502，
    // 代理层在 Range 失败时降级为完整下载（见下方 got 块）
    if (req.headers['range']) {
      upstreamHeaders['Range'] = req.headers['range']
    }

    let status, ct, bodyBuf

    if (isApiJson) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: upstreamHeaders,
      })
      clearTimeout(timer)
      status = upstream.status
      ct = upstream.headers.get('content-type')
      bodyBuf = Buffer.from(await upstream.arrayBuffer())
    } else {
      // CDN 请求：用 got (libcurl) 绕过 TLS 指纹识别
      // 如果请求带 Range 头但 CDN 不支持返回 402/403/502，降级为完整下载
      try {
        const resp = await got.get(targetUrl, {
          headers: upstreamHeaders,
          responseType: 'buffer',
          timeout: { request: PROXY_TIMEOUT_MS },
          followRedirect: true,
          retry: { limit: 0 },
        })
        status = resp.statusCode
        ct = resp.headers['content-type'] || null
        bodyBuf = resp.body
      } catch (err) {
        // Range 降级：客户端带了 Range，但 CDN 不支持返回错误码
        // 去掉 Range 头，完整下载整个文件给客户端（客户端需要多少自己截）
        const httpErrCodes = [400, 402, 403, 500, 501, 502, 503]
        if (req.headers['range'] && err.response && httpErrCodes.includes(err.response.statusCode)) {
          try {
            delete upstreamHeaders['Range']
            const resp2 = await got.get(targetUrl, {
              headers: upstreamHeaders,
              responseType: 'buffer',
              timeout: { request: PROXY_TIMEOUT_MS },
              followRedirect: true,
              retry: { limit: 0 },
            })
            status = resp2.statusCode
            ct = resp2.headers['content-type'] || null
            bodyBuf = resp2.body
          } catch (err2) {
            if (err2.response) {
              status = err2.response.statusCode
              ct = err2.response.headers['content-type'] || null
              bodyBuf = err2.response.body ? Buffer.from(err2.response.body) : Buffer.alloc(0)
            } else {
              throw err2
            }
          }
        } else if (err.response) {
          status = err.response.statusCode
          ct = err.response.headers['content-type'] || null
          bodyBuf = err.response.body ? Buffer.from(err.response.body) : Buffer.alloc(0)
        } else {
          throw err
        }
      }
    }

    const headers = {}
    if (ct) headers['Content-Type'] = ct
    headers['Cache-Control'] = kind === 'image' ? 'public, max-age=86400, immutable' : 'no-store'
    headers['Access-Control-Allow-Origin'] = '*'

    if (kind && status === 200) {
      let buf = bodyBuf
      if (kind === 'm3u8') {
        putCache(kind, cacheKey, buf, headers)
        parseAndPrefetchTs(buf, host, rawPath)
        buf = rewriteM3u8(buf, host)
      } else if (kind === 'image' && sharp) {
        // 图片压缩：WebP 优先（支持 WebP 的浏览器小 ~60%），否则 JPG 重编码
        // 封面图盒子最大 ~200px 宽，给 400px 足够清晰（@2x retina）
        try {
          const accept = req.headers['accept'] || ''
          const useWebp = accept.includes('image/webp')
          const out = sharp(buf).rotate().resize({ width: 400, height: 600, fit: 'cover' })
          let outBuf, outCt
          if (useWebp) { outBuf = await out.webp({ quality: 70, effort: 3 }).toBuffer(); outCt = 'image/webp' }
          else         { outBuf = await out.jpeg({ quality: 70, mozjpeg: true }).toBuffer(); outCt = 'image/jpeg' }
          if (outBuf.length < buf.length) { buf = outBuf; headers['Content-Type'] = outCt }
        } catch { /* sharp 失败 → 原样返回 */ }
        putCache(kind, cacheKey, buf, headers)
      } else {
        putCache(kind, cacheKey, buf, headers)
      }
      res.writeHead(status, headers)
      res.end(buf)
    } else {
      res.writeHead(status, headers)
      res.end(bodyBuf || Buffer.alloc(0))
    }
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e && e.message || e) }))
    } else {
      try { res.end() } catch {}
    }
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, ts: Date.now(), uptime: process.uptime() }))
    return
  }
  if (url.startsWith('/api-proxy/')) {
    proxyApi(req, res)
  } else {
    serveStatic(req, res)
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('[server] listening on http://0.0.0.0:' + PORT)
  warmUpConnections()
})

// 优雅关闭
function shutdown() {
  console.log('[server] shutting down...')
  server.close(() => {
    console.log('[server] closed all connections')
    process.exit(0)
  })
  setTimeout(() => { console.log('[server] force exit'); process.exit(1) }, 5000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// 预热所有已知站长 host：发一个 OPTIONS 让 undici 建好连接
const WARMUP_HOSTS = [
  'changzhang.tv',
]
async function warmUpConnections() {
  for (const host of WARMUP_HOSTS) {
    try {
      // 发一个小请求（ac=top limit=1 最轻量），让 undici 建立好连接池
      fetch(`https://${host}/api.php/provide/vod/?ac=top&limit=1`, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Referer': `https://${host}/` },
        signal: AbortSignal.timeout(5000),
      }).then(r => r.text().catch(() => {})).catch(() => {})
    } catch {}
  }
  console.log('[server] warm up triggered for', WARMUP_HOSTS.length, 'hosts')
}
