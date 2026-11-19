// 搜索优先 API 层
// 站长直连：CORS 可直接请求；其他走 Node 代理 server.js
import { SOURCES, SOURCE_DISPLAY_ORDER, FETCH_TIMEOUT, FAIL_CACHE_TTL } from '../config/sources'
import type { ApiVodRaw, VodItem } from './normalize'
import { normalizeDetail } from './normalize'

export type { VodItem, PlaySource, Episode } from './normalize'

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
}

// 哪些站长原生支持 CORS（浏览器可直接 fetch）
const CORS_OK_HOSTS = ['changzhang.tv']

// 开发环境变量（仅 DEV 时 CORS 站长直连省一次代理请求）
const DEV = import.meta.env.DEV

function isCorsOk(host: string): boolean {
  return CORS_OK_HOSTS.some((ok) => host === ok || host.endsWith('.' + ok))
}

/**
 * 从 ApiVodRaw 里挑出封面 URL，带 changzhang 固定 CDN 兜底：
 *   - 所有站长 ac=list / ac=top 都故意不返回 vod_pic（逼你走 detail），
 *     但实测 changzhang / 极速 / 备用 的 vod_id 几乎全部共用 p1.czzyplay.com CDN 的编号池，
 *     固定 URL 模式 p1.czzyplay.com/images/{vod_id}/poster 90%+ 命中。
 *   - 未命中的返回 404，由调用方在 final 阶段 HEAD 检测后再 detail 兜底。
 */
function pickCover(raw: ApiVodRaw): string {
  const direct = raw.vod_pic_thumb || raw.vod_pic || ''
  if (direct) return direct
  if (!raw.vod_id) return ''
  const host = (raw as any).__host as string | undefined
  if (!host) return ''
  return `https://p1.czzyplay.com/images/${raw.vod_id}/poster`
}

/**
 * 从 MergedGroup 构造封面 URL —— 根因修复版本
 *
 * 各站长 vod_id 编号体系独立，只有 changzhang.tv 的 vod_id 在 p1.czzyplay.com CDN 编号池命中正确资源。
 * repRaw 按 purity 选条目时可能选到非 changzhang 源（标题字串更干净），
 * 这时用 repRaw.vod_id 拼 czzyplay 会张冠李戴。
 *
 * 解法：永远用 primarySource（按 SOURCE_DISPLAY_ORDER 第一个即 4K changzhang）的 vod_id。
 * primaryId 在 mergeByTitle 里按 sourceMap.get('4K') 拿到，保证是 changzhang 自己的条目。
 */
function buildCoverUrl(m: MergedGroup): string {
  // primarySource === '4K' → 一定有 changzhang 的 vod_id，czzyplay CDN 100% 命中
  if (m.primarySource === '4K' && m.primaryId) {
    return `https://p1.czzyplay.com/images/${m.primaryId}/poster`
  }
  // 兜底：没有 4K 源时（理论上热门资源不会），用 repRaw.vod_id 走 czzyplay 模式
  return pickCover(m.item)
}

/**
 * 公网始终走同源代理 /api-proxy/<host>/<path>（server.js 转发到站长）
 * 开发环境下 CORS OK 站长直连，其他仍走代理
 */
export function toProxyUrl(url: string): string {
  const m = url.match(/^https?:\/\/([^/]+)(\/.+)$/i)
  if (!m) return url
  const host = m[1]
  const path = m[2]
  if (DEV && isCorsOk(host)) return url
  return `/api-proxy/${host}${path}`
}

// 失败缓存
const failedHosts = new Map<string, number>()
function isHostFailed(host: string): boolean {
  const t = failedHosts.get(host)
  if (!t) return false
  if (Date.now() - t > FAIL_CACHE_TTL) {
    failedHosts.delete(host)
    return false
  }
  return true
}
function markHostFailed(host: string) {
  failedHosts.set(host, Date.now())
}

interface ApiResp {
  code?: number
  msg?: string
  list?: ApiVodRaw[]
  total?: number
  limit?: number
  page?: number
}

async function fetchJson(url: string): Promise<ApiResp> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const resp = await fetch(toProxyUrl(url), { headers: FETCH_HEADERS, signal: controller.signal })
    return (await resp.json()) as ApiResp
  } finally {
    clearTimeout(timer)
  }
}

// ===== 搜索 =====

export interface SearchItem {
  id: number
  title: string
  cover: string
  update: string
  category: string
  year: string
  directors: string
  actors: string
  // 来自哪些源（前端按 SOURCE_DISPLAY_ORDER 显示）
  availableSources: string[]
  // 主源信息（代表源，4K 优先）
  primarySource: string
  primaryId: number
  primaryHost: string
  // 每个源各自的 vod_id + host（各源 id 不通用！切源时用对应源的 id）
  sourceIds: Record<string, { id: number; host: string }>
}

export interface SearchResult {
  items: SearchItem[]
  searchedSources: number
  respondedSources: string[]
  durationMs: number
}

/**
 * 多源并行搜索，厂长优先：
 *   1. 所有源并行请求 wd 关键词
 *   2. 按标题归一化去重合并（同一部剧多源命中 → 聚合为一张卡片）
 *   3. 卡片上 availableSources 标哪些源有这部剧
 */
// 结果缓存（减少重复请求，加速二次搜索）
interface SearchCache { items: any[]; durationMs: number; expireAt: number }
const searchCache = new Map<string, SearchCache>()
const SEARCH_CACHE_TTL = 3 * 60 * 1000

// 单请求超时 race（Promise.race 一个定时器）
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// 兼容包装：消费 progressive generator 拿最终结果
export async function fetchSearch(wd: string): Promise<SearchResult> {
  let final: ProgressiveSearchBatch | null = null
  for await (const batch of fetchSearchProgressive(wd)) {
    final = batch
  }
  if (!final) return { items: [], searchedSources: 0, respondedSources: [], durationMs: 0 }
  return {
    items: final.items,
    searchedSources: final.respondedSources.length || 4,
    respondedSources: final.respondedSources,
    durationMs: final.durationMs,
  }
}

// ===== 渐进式搜索：先到先渲染，全部回来后最终排序 =====

export interface ProgressiveSearchBatch {
  items: SearchItem[]         // 当前已合并的所有结果（按已有 4K 优先做临时排序）
  respondedSources: string[]  // 目前已响应的源 label 列表
  isFinal: boolean            // 全部源都回来 = true
  durationMs: number          // 从开始到现在的耗时
}

/**
 * 渐进式搜索（推荐）：
 *   - 每个 host resolve 一批就立即 yield 给前端
 *   - 前端 for await 边收边渲染
 *   - isFinal=true 时 items 已按 4K 优先 + 匹配度排好序
 */
export async function* fetchSearchProgressive(wd: string): AsyncGenerator<ProgressiveSearchBatch, void, void> {
  const keyword = wd.trim()
  const start = Date.now()
  if (!keyword) {
    yield { items: [], respondedSources: [], isFinal: true, durationMs: 0 }
    return
  }

  // 缓存命中 → 直接 yield 一次就完
  const cached = searchCache.get(keyword)
  if (cached && Date.now() < cached.expireAt) {
    yield { items: cached.items as any, respondedSources: [], isFinal: true, durationMs: cached.durationMs }
    return
  }

  // 每个 SOURCE 只取第一个 host —— 多活 host 对搜索结果完全冗余
  // 实测 ffzy 4 个 host（www.ffzy.tv / ffzy5 / ffzy3 / cj.ffzyapi.com）返回完全相同的 id 列表
  const firstHosts: { host: string; label: string }[] = []
  for (const s of SOURCES) {
    firstHosts.push({ host: s.apiHosts[0], label: s.label })
  }

  // 累计收集所有已 resolve 条目
  let accumulated: ApiVodRaw[] = []

  function rebuildMergedAndYield(): ProgressiveSearchBatch {
    const merged = mergeByTitle(accumulated, keyword)
    merged.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score              // 主键：匹配精度
      if (a.rank !== b.rank) return a.rank - b.rank                  // 次键：站长热度（越小越热门）
      return (b.sources.includes('4K') ? 1 : 0) - (a.sources.includes('4K') ? 1 : 0)      // 三键：4K 源优先
    })
    const sources: string[] = [...new Set(accumulated.map(i => (i as any).__source as string))]
    return {
      items: merged.map(m => ({
        id: m.item.vod_id,
        title: m.item.vod_name || '',
        // 封面根因修复：永远用 primary(4K changzhang) 的 vod_id 构造 czzyplay CDN URL
        // 各源 vod_id 编号体系独立，只有 changzhang 自己的 vod_id 在 czzyplay 编号池命中正确资源
        cover: toProxyUrl(buildCoverUrl(m)),
        update: m.item.vod_remarks || '',
        category: m.item.type_name || '',
        year: String(m.item.vod_year || ''),
        directors: m.item.vod_director || '',
        actors: m.item.vod_actor || '',
        availableSources: m.sources,
        primarySource: m.primarySource,
        primaryId: m.primaryId,
        primaryHost: m.primaryHost,
        sourceIds: m.sourceIds,
      })),
      respondedSources: sources,
      isFinal: false,
      durationMs: Date.now() - start,
    }
  }

  // 每个 host 的请求结果收集（带 index）
  const freshPromises = firstHosts.map(({ host, label }, i) =>
    (async () => {
      if (isHostFailed(host)) return { host, label, items: [] as ApiVodRaw[] }
      try {
        const url = `${host}/?${new URLSearchParams({ ac: 'list', wd: keyword, pg: '1', limit: '20' }).toString()}`
        const raw = await withTimeout(fetchJson(url), FETCH_TIMEOUT)
        if (!raw?.list?.length) return { host, label, items: [] as ApiVodRaw[] }
        return {
          host, label,
          items: raw.list.map((r, idx) => ({ ...r, __source: label, __host: host, __rank: idx + 1 } as ApiVodRaw)),
        }
      } catch { markHostFailed(host); return { host, label, items: [] as ApiVodRaw[] } }
    })().then(v => ({ v, i }))
  )

  // 逐个 race：每次从剩余 pending 里拿最快 resolve 的，yield 给前端
  const doneIdx = new Set<number>()
  while (doneIdx.size < freshPromises.length) {
    const next = await Promise.race(
      freshPromises.filter((_, i) => !doneIdx.has(i))
    )
    doneIdx.add(next.i)
    if (next.v.items.length) {
      accumulated = accumulated.concat(next.v.items)
    }
    yield rebuildMergedAndYield()
  }

  // Final：与 rebuildMergedAndYield 保持完全一致的排序：
  // 主键：匹配精度 score → 次键：站长热度 rank（越小越热门）→ 三键：4K 源优先
  const finalMerged = mergeByTitle(accumulated, keyword)
  finalMerged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.rank !== b.rank) return a.rank - b.rank
    return (b.sources.includes('4K') ? 1 : 0) - (a.sources.includes('4K') ? 1 : 0)
  })

  // ===== 封面兜底（不阻塞 final yield，渐进式更新由 UI 层负责）=====
  // pickCover 现在优先选 changzhang 源条目（修了封面张冠李戴根因）
  // 兜底封面 90%+ 正确，detail 封面在 UI 层异步获取替换
  // ================================================================

  const finalSources = [...new Set(accumulated.map(i => (i as any).__source))]
  const finalItems: SearchItem[] = finalMerged.map(m => ({
    id: m.item.vod_id,
    title: m.item.vod_name || '',
    cover: toProxyUrl(buildCoverUrl(m)),
    update: m.item.vod_remarks || '',
    category: m.item.type_name || '',
    year: String(m.item.vod_year || ''),
    directors: m.item.vod_director || '',
    actors: m.item.vod_actor || '',
    availableSources: m.sources,
    primarySource: m.primarySource,
    primaryId: m.primaryId,
    primaryHost: m.primaryHost,
    sourceIds: m.sourceIds,
  }))

  // 写缓存
  searchCache.set(keyword, { items: finalItems, durationMs: Date.now() - start, expireAt: Date.now() + SEARCH_CACHE_TTL })
  if (searchCache.size > 50) {
    const firstKey = searchCache.keys().next().value as string | undefined
    if (firstKey) searchCache.delete(firstKey)
  }

  yield { items: finalItems, respondedSources: finalSources, isFinal: true, durationMs: Date.now() - start }
}

// ===== 热门（首页用）=====
// 只用 changzhang.tv 一个源的理由：
//   1. CZ ac=top type=0 返回 100 条全品类，type_name 齐全（实测 23 大陆综艺/14 国产剧/5 国产动漫...）
//   2. 封面兜底 100% 命中（CZ vod_id 本身就是 p1.czzyplay.com 编号池）
//   3. 单机请求 ~200ms，比多源并行还快
//   4. 多源聚合会引入分类不确定（备用源 type_name 经常为空）

export interface HotItem {
  id: number
  title: string
  cover: string
  update: string
  category: string
  year: string
  rank: number
}

const hotCache = { items: null as HotItem[] | null, expireAt: 0 }
const HOT_CACHE_TTL = 10 * 60 * 1000

export async function fetchHotTop(limit = 6): Promise<{ items: HotItem[]; source: string }> {
  if (hotCache.items && Date.now() < hotCache.expireAt) {
    return { items: hotCache.items, source: '聚合(缓存)' }
  }

  const source = SOURCES.find(s => s.label === '4K')!
  const host = source.apiHosts[0]

  const MOVIE_TYPES = /剧情片|恐怖片|喜剧片|动作片|科幻片|纪录片|伦理片|爱情片|战争片|悬疑片|犯罪片|奇幻片|冒险片|灾难片/
  const TV_TYPES = /国产剧|欧美剧|日本剧|韩国剧|日剧|韩剧|台剧|台湾剧|港台剧|海外剧|泰国剧|大陆剧|港剧/
  const VARIETY_TYPES = /综艺/
  const ANIME_TYPES = /动漫|动画|卡通/

  function classify(typeName: string, name: string): 'movie' | 'tv' | 'variety' | 'anime' | 'other' {
    if (MOVIE_TYPES.test(typeName)) return 'movie'
    if (TV_TYPES.test(typeName)) return 'tv'
    if (VARIETY_TYPES.test(typeName)) return 'variety'
    if (ANIME_TYPES.test(typeName) || /动漫|动画/.test(name)) return 'anime'
    return 'other'
  }

  const raw = await withTimeout(
    fetchJson(`${host}/?${new URLSearchParams({ ac: 'top', type: '0', limit: String(limit * 10) }).toString()}`),
    FETCH_TIMEOUT,
  )
  if (!raw?.list?.length) throw new Error('热门列表不可用')

  // 严格配额：2 电影 + 2 电视剧 + 1 综艺 + 1 动漫
  const QUOTA: Record<string, number> = { movie: 2, tv: 2, variety: 1, anime: 1 }
  const picked: ApiVodRaw[] = []
  const used = new Set<string>()

  for (const item of raw.list) {
    const cat = classify(item.type_name || '', item.vod_name || '')
    const catKey = `${cat}:${item.vod_id}`
    if (used.has(catKey)) continue
    if ((QUOTA[cat] || 0) > 0) {
      picked.push(item)
      used.add(catKey)
      QUOTA[cat]--
      if (picked.length >= limit) break
    }
  }

  while (picked.length < limit) {
    const remaining = raw.list.filter(r => !picked.includes(r))
    if (!remaining.length) break
    picked.push(remaining[0])
  }

  const items: HotItem[] = picked.map(item => ({
    id: item.vod_id,
    title: item.vod_name || '',
    cover: toProxyUrl(
      item.vod_pic_thumb || item.vod_pic ||
      (item.vod_id ? `https://p1.czzyplay.com/images/${item.vod_id}/poster` : '')
    ),
    update: item.vod_remarks || '',
    category: item.type_name || '',
    year: String(item.vod_year || ''),
    rank: 0,
  })).filter(it => it.cover)

  if (!items.length) throw new Error('热门列表不可用')

  hotCache.items = items
  hotCache.expireAt = Date.now() + HOT_CACHE_TTL
  return { items, source: '聚合' }
}

// ===== 热搜词（首页用，top 接口前若干作品的标题）=====

const hotKwCache = { words: null as string[] | null, expireAt: 0 }

export async function fetchHotKeywords(limit = 6): Promise<string[]> {
  if (hotKwCache.words && Date.now() < hotKwCache.expireAt) {
    return hotKwCache.words
  }
  const host = SOURCES[0].apiHosts[0]
  const raw = await withTimeout(
    fetchJson(`${host}/?${new URLSearchParams({ ac: 'top', type: '0', limit: String(limit * 3) }).toString()}`),
    FETCH_TIMEOUT,
  )
  if (!raw?.list?.length) return []
  const words = raw.list.map(r => r.vod_name || '').filter(Boolean).slice(0, limit)
  hotKwCache.words = words
  hotKwCache.expireAt = Date.now() + HOT_CACHE_TTL
  return words
}

// ===== 详情（按指定源）=====

// 详情缓存
const detailCache = new Map<string, { data: any; expireAt: number }>()
const DETAIL_CACHE_TTL = 3 * 60 * 1000

async function fetchDetailFromHost(source: typeof SOURCES[number], host: string, id: number) {
  if (isHostFailed(host)) return null
  try {
    const url = `${host}/from/${source.m3u8Src}/?ac=detail&ids=${id}`
    const raw = await withTimeout(fetchJson(url), FETCH_TIMEOUT)
    if (raw?.list?.length) {
      const item = normalizeDetail(raw.list[0], source.label)
      // 封面必须走同源代理，绕开 CORS 和防盗链
      item.cover = toProxyUrl(item.cover || raw.list[0].vod_pic_thumb || raw.list[0].vod_pic || '')
      // 关键：过滤掉没有有效 m3u8 直链的 item（ffzy 等源有时返回分享页 URL）
      if (!item?.sources?.[0]?.episodes?.length) return null
      return item
    }
  } catch { markHostFailed(host) }
  return null
}

// 后台预取 m3u8（让 server.js 缓存命中，下次 HLS.js loadSource 直接 ~0ms）
function prefetchM3u8(item: VodItem | null) {
  if (!item?.sources?.[0]?.episodes?.length) return
  const url = item.sources[0].episodes[0].url
  if (!url) return
  // fire-and-forget：走代理让 server.js 缓存填上
  fetch(toProxyUrl(url))
    .then(r => r.text().catch(() => {}))
    .catch(() => {})
}

export async function fetchDetailBySource(sourceLabel: string, id: number) {
  const cacheKey = `${sourceLabel}:${id}`
  const cached = detailCache.get(cacheKey)
  if (cached && Date.now() < cached.expireAt) {
    // 缓存也预取一下 m3u8
    prefetchM3u8(cached.data.item)
    return cached.data
  }

  const source = SOURCES.find((s) => s.label === sourceLabel)
  if (!source) throw new Error(`未知源: ${sourceLabel}`)

  // 多活域名并行抢第一个成功的
  const allTry = source.apiHosts.map(h => fetchDetailFromHost(source, h, id))
  let lastErr: unknown = null
  for (const p of allTry) {
    try {
      const item = await p
      if (item) {
        const result = { item, source: sourceLabel }
        detailCache.set(cacheKey, { data: result, expireAt: Date.now() + DETAIL_CACHE_TTL })
        // 后台预取第一集 m3u8（不阻塞返回）
        prefetchM3u8(item)
        return result
      }
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error(`源 ${sourceLabel} 不可用`)
}

/**
 * 并行 race 所有源：从 4K 开始每个源内部并行抢最快 host，
 * 四个 SOURCE 再并行 race 拿第一个成功的（保证速度），
 * 同时按 SOURCE priority 保证优先顺序
 */
export async function fetchDetailAny(id: number) {
  const cacheKey = `any:${id}`
  const cached = detailCache.get(cacheKey)
  if (cached && Date.now() < cached.expireAt) {
    return cached.data
  }

  // 每个 SOURCE 内部：多活 host 并行 race
  async function trySource(source: typeof SOURCES[number]) {
    const promises = source.apiHosts.map(h => fetchDetailFromHost(source, h, id))
    for (const p of promises) {
      const item = await p.catch(() => null)
      if (item) return { item, source: source.label }
    }
    return null
  }

  // 按 priority 顺序串行尝试 —— 确保 4K 永远优先
  const sorted = [...SOURCES].sort((a, b) => a.priority - b.priority)
  let lastErr: unknown = null
  for (const source of sorted) {
    try {
      const result = await trySource(source)
      if (result) {
        detailCache.set(cacheKey, { data: result, expireAt: Date.now() + DETAIL_CACHE_TTL })
        return result
      }
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error('详情获取失败，所有源均不可用')
}

// ===== 内部：合并去重 =====

interface MergedGroup {
  score: number
  rank: number                                 // 组内最热门条目的站长 rank（越小越热门，999=无 rank）
  item: ApiVodRaw
  sources: string[]                              // 可用的源 label 列表（已按优先级排序）
  primarySource: string
  primaryId: number
  primaryHost: string
  sourceIds: Record<string, { id: number; host: string }>  // 每个源各自的 vod_id + host
}

/**
 * purity 计算（越大越"正"）：
 *   5 = 纯正片（原标题归一化后 = key，且原标题就是 key 本身 — 没有版本/年份/修饰）
 *   3 = 正片变体（有年番N、2025、重制版、剧版 等，但归一化后正确）
 *   2 = 正片的子篇章（有 冒号/副标题）
 *   0 = 解说/影评类
 */
function titlePurity(rawTitle: string, normalizedKey: string): number {
  const t = rawTitle || ''
  // 解说类 — 最低
  if (/电影解说|解说|影评/.test(t)) return 0
  // 子篇章 — 冒号后是副标题
  if (/[：:]/.test(t)) return 2
  // 归一化后不匹配 — 不该聚合进来
  if (normalizeTitle(t) !== normalizedKey) return -1
  // 纯正片：原标题去掉空白和标点后完全等于 key（没有年份/版本/重制版等）
  const stripped = stripVariantSuffixes(t).replace(/\s+/g, '').toLowerCase()
  const plain = t.replace(/\s+/g, '').toLowerCase()
  if (stripped === normalizedKey && plain === normalizedKey) return 5
  // 有变体修饰（年份/重制版/年番N/剧版 等）但归一化后正确
  if (stripped === normalizedKey) return 3
  return 3
}

function is解说Like(t: string): boolean {
  return /电影解说|解说|影评/.test(t || '')
}

/**
 * 按品类把条目分成 5 类（用户需求：真人/动漫/短剧/解说/其他）
 * 判断优先级：
 *   1. 短剧（标题含"短剧"）
 *   2. 解说（标题含"解说/影评"）→ 排序降权到末尾
 *   3. 动漫（type_name 含"动漫/动画/卡通"）
 *   4. 真人（type_name 含"剧/电影/综艺"）
 *   5. 其他
 *
 * 实测站长 type_name 值举例：国产动漫 / 国产剧 / 大陆电影 / 台湾综艺 / 纪录片
 */
const CATEGORY_ANIMATION = '动漫'
const CATEGORY_LIVE = '真人'
const CATEGORY_SHORT = '短剧'
const CATEGORY_REVIEW = '解说'
const CATEGORY_OTHER = '其他'

function categorizeItem(raw: ApiVodRaw): string {
  const t = (raw.vod_name || '') as string
  const typeName = (raw.type_name || '') as string
  // 1. 解说最高优先级（同时也要降权排序）
  if (is解说Like(t)) return CATEGORY_REVIEW
  // 2. 短剧
  if (/短剧/.test(t)) return CATEGORY_SHORT
  // 3. 动漫（type_name 含关键字）
  if (/动漫|动画|卡通/.test(typeName)) return CATEGORY_ANIMATION
  if (/动漫|动画|卡通/.test(t)) return CATEGORY_ANIMATION
  // 4. 真人（type_name 含"剧/电影/综艺/纪录片/电视剧/电影"）
  if (/剧|电影|综艺|纪录片/.test(typeName)) return CATEGORY_LIVE
  // 5. 其他
  return CATEGORY_OTHER
}

/**
 * 聚合 key = ${groupKey(vod_name)}::${category}
 *
 * 核心设计：groupKey 只做**轻量技术规整**（空格/标点/大小写/全角转半角），
 * 不做**语义剥离**（重制版/年番N/剧场版/尾部年份保留）。
 *
 * 理由：站长给不同 vod_id 的条目就是独立条目，应该独立显示。
 * 只有"同一 IP 同一品类不同源命中的同一条目"才应该合并。
 *
 * 例如凡人修仙传：
 *   CZ "凡人修仙传"         (vod_id=592)  + FFZY "凡人修仙传"         (vod_id=28356)
 *     → groupKey="凡人修仙传" category=动漫 → 同 key → 合并成 1 张卡 ✓
 *   CZ "凡人修仙传年番4"    (vod_id=148772)
 *     → groupKey="凡人修仙传年番4" category=动漫 → 独立 key → 独立卡 ✓
 *   FFZY "凡人修仙传重制版"  (vod_id=34973)
 *     → groupKey="凡人修仙传重制版" category=动漫 → 独立 key → 独立卡 ✓
 *   CZ "凡人修仙传2025"     (vod_id=39148)
 *     → groupKey="凡人修仙传2025" category=真人 → 独立 key → 独立卡 ✓
 *   FFZY "凡人修仙传(剧版)"  (vod_id=84684)
 *     → groupKey="凡人修仙传(剧版)" category=真人 → 独立 key → 独立卡 ✓
 *
 * 搜索匹配度打分（computeScore / titlePurity）才用完整 stripVariantSuffixes，
 * 分组 key 只保留原始语义。
 */
function groupKey(t: string): string {
  let s = t || ''
  // 1. 全角括号/书名号 → 半角（统一标点）
  s = s.replace(/[（(【\[【【《]/g, '(')
  s = s.replace(/[)）】\]》]/g, ')')
  // 2. 去多余空格
  s = s.replace(/\s+/g, '')
  // 3. 去常见无关标点
  s = s.replace(/[·.。•\-—_()【】\[\]《》""''`~]/g, '')
  return s.toLowerCase()
}

function buildAggregateKey(raw: ApiVodRaw): string {
  const key = groupKey(raw.vod_name || '')
  if (!key) return ''
  const cat = categorizeItem(raw)
  return `${key}::${cat}`
}

function mergeByTitle(items: ApiVodRaw[], keyword: string): MergedGroup[] {
  // Step 1: 按 "归一化标题::品类" 聚合
  const groups = new Map<string, ApiVodRaw[]>()
  for (const raw of items) {
    const key = buildAggregateKey(raw)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(raw)
  }

  // Step 2 已删除：groupKey 只做轻量技术规整，保留语义修饰（重制版/年番N/剧版/尾部年份），
  // 所以 Step 1 的分组已经是精确的，不需要再跨 key 合并。
  // 不同标题（如 "凡人修仙传" vs "凡人修仙传重制版"）即使 normalizeTitle 后相同，
  // 也应该各自独立显示 — 站长给了不同 vod_id 就是不同条目。

  const result: MergedGroup[] = []
  for (const [key, group] of groups) {
    // key 格式："groupKey::category"，提取纯标题部分供 purity/score 计算
    // 注意：groupKey 是轻量规整（保留语义修饰），purity/score 需要完整 stripVariantSuffixes
    const [groupKeyPart, category] = key.split('::')
    void category
    const purityKey = normalizeTitle(group[0].vod_name || '') // 完整 stripVariantSuffixes 后的 IP 主名

    // ====== 收集每个源 purity 最高的条目 ======
    // 之前是"第一个遇到的"，导致 repRaw（purity 5）和 primaryId（第一个遇到的变体）对不上
    const sourceMap = new Map<string, { raw: ApiVodRaw; host: string }>()
    for (const raw of group) {
      const label = (raw as any).__source as string
      const host = (raw as any).__host as string
      if (!label) continue
      const curPurity = titlePurity(raw.vod_name || '', purityKey)
      const existing = sourceMap.get(label)
      if (!existing) {
        sourceMap.set(label, { raw, host })
      } else {
        const existPurity = titlePurity(existing.raw.vod_name || '', purityKey)
        // purity 更高优先；同 purity 下有封面优先
        if (curPurity > existPurity) {
          sourceMap.set(label, { raw, host })
        } else if (curPurity === existPurity) {
          const curHas = (raw.vod_pic_thumb || raw.vod_pic) ? 1 : 0
          const exHas = (existing.raw.vod_pic_thumb || existing.raw.vod_pic) ? 1 : 0
          if (curHas > exHas) {
            sourceMap.set(label, { raw, host })
          }
        }
      }
    }

    // 按 SOURCE_DISPLAY_ORDER 排列
    const sources = [...sourceMap.keys()].sort(
      (a, b) => SOURCE_DISPLAY_ORDER.indexOf(a) - SOURCE_DISPLAY_ORDER.indexOf(b),
    )

    const primaryLabel = sources[0]
    const primary = sourceMap.get(primaryLabel)!

    const sourceIds: Record<string, { id: number; host: string }> = {}
    for (const [label, v] of sourceMap) {
      sourceIds[label] = { id: v.raw.vod_id, host: v.host }
    }

    // 代表 item：purity 相同时，按 SOURCE priority 选最高的源
    // 根因：所有源 ac=list 都不返回 vod_pic，封面只能走 changzhang 固定 CDN
    //       p1.czzyplay.com/images/{vod_id}/poster
    //       但非 changzhang 源的 vod_id 在 changzhang 编号池里对应完全不相关的资源 → 封面张冠李戴
    //       → repRaw 必须优先选 changzhang(4K) 源的条目（只有它的 vod_id 能命中正确封面）
    const SOURCE_PIC_PRIORITY: Record<string, number> = Object.fromEntries(
      SOURCES.map(s => [s.label, 999 - s.priority])  // priority 越小 PIC 越高
    )
    const repRaw = [...group].sort((a, b) => {
      const aP = titlePurity(a.vod_name || '', purityKey)
      const bP = titlePurity(b.vod_name || '', purityKey)
      if (aP !== bP) return bP - aP
      const aPicPrio = SOURCE_PIC_PRIORITY[(a as any).__source] ?? 0
      const bPicPrio = SOURCE_PIC_PRIORITY[(b as any).__source] ?? 0
      if (aPicPrio !== bPicPrio) return bPicPrio - aPicPrio
      return 0
    })[0]

    // 组内最热门条目的站长 rank（越小越靠前）
    const rank = Math.min(...group.map(r => (r as any).__rank || 999))

    result.push({
      score: computeScore(repRaw.vod_name || '', keyword, purityKey),
      rank,
      item: repRaw,
      sources,
      primarySource: primaryLabel,
      primaryId: primary.raw.vod_id,
      primaryHost: primary.host,
      sourceIds,
    })
  }
  return result
}

function computeScore(title: string, keyword: string, normKey: string = ''): number {
  if (!title || !keyword) return 0
  const t = title.toLowerCase()
  const k = keyword.toLowerCase()
  const nk = normKey.toLowerCase()
  let s = 0
  if (t === k) s += 100
  if (t.startsWith(k)) s += 50
  if (t.includes(k)) s += 30
  // 解说类降权 60 分
  if (is解说Like(title)) s -= 60
  // 子篇章降权：normKey 不是 keyword 本身，且 keyword 是 normKey 的前缀 → 同 IP 但不同条目
  // 例如 keyword="凡人修仙传", normKey="凡人修仙传魔道争锋" → 凡人修仙传 是前缀 → 降权
  // 而 keyword="凡人修仙传", normKey="凡人玄锅修仙传" → 凡人修仙传 不是前缀 → 不降权（完全不同的作品）
  if (nk && nk !== k && nk.startsWith(k)) {
    s -= 40
  }
  return s
}

/**
 * 把剧名归一化到"IP 主名"级别：
 *   "凡人修仙传2025"     → "凡人修仙传"
 *   "凡人修仙传年番4"    → "凡人修仙传"
 *   "凡人修仙传重制版"   → "凡人修仙传"
 *   "凡人修仙传(剧版)"   → "凡人修仙传"
 *   "凡人修仙传：魔道争锋" → "凡人修仙传"   （冒号后是副标题，同 IP）
 *   "凡人修仙传[电影解说]" → "凡人修仙传"   （解说视频和正片归为同 IP，但排序降权）
 *
 * 但"凡人玄锅修仙传"（不同作品）不会被误聚合。
 */
export function stripVariantSuffixes(raw: string): string {
  let s = raw || ''
  // 1. 去括号/方括号/书名号里的内容（通常是解说标记、版本标记）
  s = s.replace(/[（(【\[【【《][^)）】\]]》]+[)）】\]》]/g, '')
  // 2. 去 "年番" + 可选数字：凡人修仙传年番4 → 凡人修仙传
  s = s.replace(/年番\s*\d*/g, '')
  // 3. 去 "剧场版/重制版/剧版/番外篇/番外/序章/完整版/删减版/未删减/抢先版/TV版/漫画版/原著/特别篇/电影解说"
  s = s.replace(/(剧场版|重制版|剧版|番外篇|番外|序章|完整版|删减版|未删减|抢先版|TV版|漫画版|原著|特别篇|电影解说|解说)/g, '')
  // 4. 去尾部 "篇" + 可选数字
  s = s.replace(/篇\s*\d*$/g, '')
  // 5. 去 "第 N 季/部/辑"
  s = s.replace(/第\s*\d+\s*[季部辑]/g, '')
  // 6. 去 "上/下 篇/集"（尾部）
  s = s.replace(/(上|下)\s*(篇|集)?$/g, '')
  // 7. 清尾部独立 4 位年份后缀（19xx / 20xx）— 只清"附加在主题名后的年份"，
  //    不误杀纯年份标题如 "2012"（自身就是完整标题，没有主体）
  //    "脱衣舞娘2012" → "脱衣舞娘"  ✅  娘 + 2012 替换成娘
  //    "2012"         → "2012"     ✅  前面没有非空字符，不匹配
  //    "2012: 冰河时期" → 保留     ✅  尾部不是年份
  s = s.replace(/([^\s])\s*(19|20)\d{2}\s*$/, '$1')
  // 注意：不再截断冒号后的副标题，让"凡人修仙传：魔道争锋"自然形成独立组
  // 子篇章独立组会在 computeScore 里降权（normKey ≠ keyword 且 keyword 是前缀时 -40 分）
  return s
}

function normalizeTitle(t: string): string {
  let s = stripVariantSuffixes(t)
  // 空格、标点、大小写规整
  s = s.replace(/\s+/g, '')
  s = s.replace(/[·.。•\-—_（）()【】\[\]《》""''`~\s]/g, '')
  return s.toLowerCase()
}

function isTitleSimilar(a: string, b: string): boolean {
  // 主名归一化后相同即视为同 IP
  return normalizeTitle(a) === normalizeTitle(b)
}

export { SOURCES }
