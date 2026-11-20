// 站长配置 — 多源并行搜索，直连优先（用用户 IP，绕过 VPS CDN 封锁）
// 封面只走 changzhang 的 czzyplay CDN（p1.czzyplay.com/images/{id}/poster），
// 因为只有 changzhang 的 vod_id 在 czzyplay 编号池 100% 命中

export interface SourceHost {
  apiHosts: string[]
  m3u8Src: string
  priority: number
  label: string
}

export const SOURCES: SourceHost[] = [
  {
    label: '4K',
    priority: 1,
    m3u8Src: 'changzhangm3u8',
    apiHosts: ['https://changzhang.tv/api.php/provide/vod'],
  },
  {
    label: '极速',
    priority: 2,
    m3u8Src: 'changzhangm3u8', // 备用源解析出的播放源也能用 changzhang CDN 播放
    apiHosts: ['https://ffzy.tv/api.php/provide/vod'],
  },
  {
    label: '备用',
    priority: 3,
    m3u8Src: 'changzhangm3u8',
    apiHosts: ['https://yemu.tv/api.php/provide/vod'],
  },
]

export const SOURCE_DISPLAY_ORDER = ['4K', '极速', '备用']

export const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  '4K':    { bg: 'bg-brand-500/20', text: 'text-brand-400' },
  '极速':  { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  '备用':  { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
}

export const FETCH_TIMEOUT = 4000
export const FAIL_CACHE_TTL = 5 * 60 * 1000
