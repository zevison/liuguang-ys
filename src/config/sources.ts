// 站长配置 — 4K 单源（changzhang，czzyplay CDN 封面 100% 命中）

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
]

export const SOURCE_DISPLAY_ORDER = ['4K']

export const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  '4K': { bg: 'bg-brand-500/20', text: 'text-brand-400' },
}

export const FETCH_TIMEOUT = 4000
export const FAIL_CACHE_TTL = 5 * 60 * 1000
