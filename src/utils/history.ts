// 搜索历史：localStorage 存最近 6 条，去重，新的置顶
const KEY = 'search_history_v1'
const MAX = 6

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x: any) => typeof x === 'string' && x.trim())
  } catch {
    return []
  }
}

export function addSearchHistory(kw: string): string[] {
  const q = (kw || '').trim()
  if (!q) return getSearchHistory()
  const list = getSearchHistory().filter(x => x !== q) // 去重
  list.unshift(q) // 置顶
  const trimmed = list.slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)) } catch {}
  return trimmed
}

export function clearSearchHistory() {
  try { localStorage.removeItem(KEY) } catch {}
}
