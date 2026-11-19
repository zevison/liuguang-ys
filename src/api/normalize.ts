// 苹果CMS V10 API 字段 → 前端统一字段
// 关键改动：normalizeDetail 里过滤非 m3u8 URL，防止 ffzy 等源返回的分享页 URL（非直链）
// 被当成 m3u8 去播导致 HLS.js 等 10 秒无画面

export interface ApiVodRaw {
  vod_id: number
  vod_name: string
  vod_pic?: string
  vod_pic_thumb?: string
  vod_remarks?: string
  vod_blurb?: string
  vod_content?: string
  vod_director?: string
  vod_actor?: string
  vod_year?: string | number
  type_name?: string
  type_id?: number
  vod_play_from?: string
  vod_play_url?: string
  [k: string]: unknown
}

export interface VodItem {
  id: number
  title: string
  cover: string
  update: string
  desc: string
  director: string
  actors: string
  year: string
  category: string
  sources: PlaySource[]
}

export interface PlaySource {
  name: string
  episodes: Episode[]
}

export interface Episode {
  name: string
  url: string        // m3u8 直链
  valid: boolean     // 是否已验证为真 m3u8 直链
}

/** 判断 URL 是否为真 m3u8 直链（不是分享页/外链）*/
export function isLikelyM3u8(url: string): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  // 必须包含 .m3u8（或 .mpd DASH 也支持）
  if (!lower.includes('.m3u8') && !lower.includes('.mpd')) return false
  // 不能包含 # 锚点（ffzy 分享页 URL 会带 #粤语$xxx）
  if (lower.includes('#')) return false
  // 不能只是分享页域名
  if (/\/share\//.test(lower)) return false
  // 排除 iframe/player 中转页
  if (/\/player\//.test(lower) && !lower.includes('.m3u8')) return false
  return true
}

export function normalizeListItem(raw: ApiVodRaw): VodItem {
  return {
    id: raw.vod_id,
    title: raw.vod_name || '',
    cover: raw.vod_pic_thumb || raw.vod_pic || '',
    update: raw.vod_remarks || '',
    desc: raw.vod_blurb || '',
    director: raw.vod_director || '',
    actors: raw.vod_actor || '',
    year: String(raw.vod_year || ''),
    category: raw.type_name || '',
    sources: [],
  }
}

/** changzhang (星辰影院) CDN 特殊处理：
 *  API 返回的是 /share/{id}/e{n} 分享页 URL（HTML），
 *  真正的 m3u8 在 /play/{id}/e{n}/index.m3u8
 */
const CZ_SHARE_RE = /^https?:\/\/([^/]+)\/share\/(\d+)(\/\w+\/?)$/i
function resolveChangzhangUrl(url: string): string | null {
  const m = url.match(CZ_SHARE_RE)
  if (!m) return null
  const host = m[1]
  const id = m[2]
  const epPath = m[3].replace(/\/+$/, '') // /e1 → e1
  return `https://${host}/play/${id}/${epPath}/index.m3u8`
}

/** 把站长源各种 URL 格式（分享页/iframe 页）解析成真正的直链 */
function resolveRealM3u8(url: string): string {
  // 1) changzhang 分享页 /share/{id}/e{n} → /play/{id}/e{n}/index.m3u8
  const cz = resolveChangzhangUrl(url)
  if (cz) return cz
  // 2) 已经是 m3u8 直链 → 原样返回
  return url
}

export function normalizeDetail(raw: ApiVodRaw, sourceLabel: string): VodItem {
  const base = normalizeListItem(raw)
  base.desc = raw.vod_content || raw.vod_blurb || ''

  // 播放源解析
  const urlBlocks = (raw.vod_play_url || '').split('$$$')

  const sources: PlaySource[] = []
  for (let i = 0; i < urlBlocks.length; i++) {
    const block = urlBlocks[i] || ''
    const episodes: Episode[] = []

    for (const line of block.split('#')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const idx = trimmed.indexOf('$')
      if (idx === -1) continue
      const name = trimmed.slice(0, idx)
      const rawUrl = trimmed.slice(idx + 1)
      // 关键：先把分享页/伪链接转换成真正的 m3u8 直链
      const url = resolveRealM3u8(rawUrl)
      episodes.push({ name, url, valid: isLikelyM3u8(url) })
    }

    // 过滤：只保留有至少 1 个有效 m3u8 直链的线路
    const validEps = episodes.filter(e => e.valid)
    if (validEps.length > 0) {
      sources.push({ name: sourceLabel, episodes: validEps })
    }
  }

  base.sources = sources
  return base
}
