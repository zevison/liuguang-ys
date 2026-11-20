<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Loader2, Film, Sparkles, X } from 'lucide-vue-next'
import { fetchSearchProgressive, type SearchItem } from '../api'
import { SOURCE_COLORS } from '../config/sources'
import { addSearchHistory } from '../utils/history'
import { getCoverUrl } from '../api/cover'

const route = useRoute()
const router = useRouter()

const items = ref<SearchItem[]>([])
const loading = ref(false)
const err = ref('')
const durationMs = ref(0)
const respondedSources = ref<string[]>([])
const isFinal = ref(false)
let abortController: AbortController | null = null

// 每个条目两阶段封面回退状态：proxy → direct → placeholder
const coverStages = new Map<number, 'proxy' | 'direct' | 'placeholder'>()

function getEffectiveCover(item: SearchItem): string {
  const orig = item.cover || ''
  if (!orig) return ''
  const stage = coverStages.get(item.id) || 'proxy'
  if (stage === 'placeholder') return ''
  if (stage === 'direct') return orig
  return getCoverUrl(orig)
}

function onCoverError(item: SearchItem) {
  const stage = coverStages.get(item.id) || 'proxy'
  if (stage === 'proxy') {
    coverStages.set(item.id, 'direct')
    // 强制重渲染让 computed 重新取值
    items.value = [...items.value]
  } else {
    coverStages.set(item.id, 'placeholder')
    items.value = [...items.value]
  }
}

const keyword = computed(() => (route.query.q as string) || '')

async function runSearch() {
  const kw = keyword.value.trim()
  if (!kw) { items.value = []; return }
  abortController?.abort()
  const ac = new AbortController()
  abortController = ac
  loading.value = true
  err.value = ''
  isFinal.value = false
  items.value = []
  respondedSources.value = []
  try {
    for await (const batch of fetchSearchProgressive(kw)) {
      if (ac.signal.aborted) return
      items.value = batch.items
      respondedSources.value = batch.respondedSources
      durationMs.value = batch.durationMs
      isFinal.value = batch.isFinal
      if (batch.isFinal) break
    }
  } catch (e: any) {
    if (!ac.signal.aborted) err.value = e.message || '搜索失败'
  } finally { loading.value = false }
  // 注：hydrateRealCovers 已移除 —— buildCoverUrl 根因修复后封面 100% 正确（用 4K changzhang 的 vod_id 拼 czzyplay CDN）
}

// 注：hydrateRealCovers 整体移除 —— buildCoverUrl 根因修复后封面直接构造 100% 正确
//     旧代码：后台 detail 接口调 primaryHost API 补全封面 → 直接 fetch 站长可能 CORS 失败 + 没走代理 + 浪费带宽

onMounted(runSearch)
watch(() => route.query.q, runSearch)
onUnmounted(() => abortController?.abort())

function openPlay(item: SearchItem) {
  router.push({
    name: 'play',
    query: {
      id: String(item.primaryId),
      source: item.primarySource,
      host: item.primaryHost,
      title: item.title,
      sourceIds: JSON.stringify(item.sourceIds),
    },
  })
}

const miniQ = ref(keyword.value)
function onMiniSearch() {
  const q = miniQ.value.trim()
  if (!q) return
  addSearchHistory(q)
  router.replace({ name: 'search', query: { q } })
}
function clearMiniQ() {
  miniQ.value = ''
}

function sourceStyle(label: string) {
  return SOURCE_COLORS[label] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}
</script>

<template>
  <div class="w-full min-w-0 space-y-5">
    <!-- 次搜索框（玻璃态 + 光晕）-->
    <div class="relative">
      <div class="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-brand-500/20 via-indigo-500/10 to-violet-500/20 opacity-50 blur-sm" />
      <div class="relative flex items-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl transition focus-within:border-brand-500/60 focus-within:bg-white/[0.08] focus-within:ring-2 focus-within:ring-brand-500/20">
        <Search class="pointer-events-none ml-3.5 h-4 w-4 text-gray-500 shrink-0" />
        <input
          v-model="miniQ"
          type="text"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="继续搜索..."
          class="flex-1 min-w-0 bg-transparent py-3 pl-2 pr-2 text-[16px] text-gray-200 placeholder:text-gray-500 focus:outline-none"
          @keyup.enter="onMiniSearch"
        />
        <button
          v-if="miniQ"
          class="mr-1 p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition"
          @click="clearMiniQ"
          aria-label="清除"
        >
          <X class="h-3.5 w-3.5" />
        </button>
        <button
          class="mr-1.5 flex items-center gap-1 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500 active:scale-95"
          @click="onMiniSearch"
        >
          <Sparkles class="h-3 w-3" />
          搜索
        </button>
      </div>
    </div>

    <!-- 状态条 -->
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <template v-if="loading || !isFinal">
        <div class="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/5 px-2.5 py-1 text-brand-300">
          <Loader2 class="h-3 w-3 animate-spin" />
          全网搜索中
        </div>
      </template>
      <template v-else-if="keyword && isFinal">
        <span class="text-gray-500">
          共 <span class="font-semibold text-gray-200">{{ items.length }}</span> 条
          <span v-if="durationMs > 0">· <span class="text-brand-400">{{ durationMs }}ms</span></span>
        </span>
      </template>
      <span v-if="respondedSources.length" class="inline-flex items-center gap-1 text-gray-500">
        <span>已聚合</span>
        <span
          v-for="s in respondedSources" :key="s"
          class="rounded-md px-1.5 py-0.5" :class="sourceStyle(s)"
        >{{ s }}</span>
      </span>
    </div>

    <!-- 骨架屏 -->
    <div v-if="loading && items.length === 0" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <div v-for="i in 12" :key="i" class="space-y-2">
        <div class="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.04]" />
        <div class="h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
        <div class="h-2 w-1/2 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>

    <!-- 错误 -->
    <div v-else-if="err && items.length === 0" class="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-8 text-center">
      <Film class="mx-auto mb-2 h-8 w-8 text-red-400/60" />
      <p class="text-sm text-red-400">{{ err }}</p>
    </div>

    <!-- 无结果 -->
    <div v-else-if="items.length === 0 && isFinal" class="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-12 text-center relative overflow-hidden">
      <div class="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-brand-500/5 blur-2xl" />
      <Film class="relative mx-auto mb-3 h-10 w-10 text-gray-600" />
      <p class="relative text-sm text-gray-500">没有找到相关内容</p>
      <p class="relative mt-1 text-xs text-gray-600">试试其他关键词？</p>
    </div>

    <!-- 结果列表 -->
    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      <div
        v-for="(item, idx) in items"
        :key="item.primarySource + '-' + item.primaryId"
        class="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/30 hover:bg-white/[0.06] hover:shadow-xl hover:shadow-brand-500/10"
        :style="{ animationDelay: `${Math.min(idx * 25, 250)}ms` }"
        @click="openPlay(item)"
      >
        <!-- hover 光晕 -->
        <div class="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style="background: radial-gradient(circle at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%);" />

        <!-- 封面容器：背景渐变作为兜底，img 正常显示时覆盖 -->
        <div class="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-white/[0.03] to-white/[0.06]">
          <!-- 图片骨架屏（加载中 pulse） + fallback 文字（加载失败时显示）-->
          <div
            v-if="getEffectiveCover(item)"
            class="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.04] to-white/[0.08] z-0"
          />
          <div
            class="absolute inset-0 z-10 flex items-center justify-center text-xl font-bold tracking-wider text-gray-500"
            :class="getEffectiveCover(item) ? 'opacity-0 pointer-events-none' : 'opacity-100'"
          >{{ item.title.slice(0, 2) }}</div>
          <img
            v-if="getEffectiveCover(item)"
            :src="getEffectiveCover(item)"
            :alt="item.title"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            @load="($event.target as HTMLImageElement).style.opacity = '1'"
            @error="onCoverError(item)"
            class="absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-300 group-hover:scale-105 opacity-0"
          />
          <!-- 更新标签 -->
          <div
            v-if="getEffectiveCover(item) && item.update"
            class="absolute right-1.5 top-1.5 z-20 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
          >{{ item.update }}</div>
          <!-- hover 播放遮罩（仅桌面鼠标设备显示，iOS Safari 触摸会冻结 hover 状态）-->
          <div
            v-if="getEffectiveCover(item)"
            class="absolute inset-0 z-20 hidden items-center justify-center bg-black/0 opacity-0 transition duration-300 md:flex md:bg-black/40 md:opacity-100 group-hover:bg-black/40 group-hover:opacity-100"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/90 shadow-lg shadow-brand-500/40 backdrop-blur-sm transition md:scale-100 group-hover:scale-110">
              <svg class="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 信息 -->
        <div class="space-y-1.5 p-2.5 sm:p-3 min-w-0">
          <h3 class="truncate min-w-0 text-xs sm:text-sm font-medium text-gray-100 transition group-hover:text-brand-400">
            {{ item.title }}
          </h3>
          <div class="flex items-center gap-1 text-[10px] text-gray-500">
            <span v-if="item.category">{{ item.category }}</span>
            <span v-if="item.year">· {{ item.year }}</span>
          </div>
          <!-- 来源标签 -->
          <div class="flex flex-wrap gap-1">
            <span
              v-for="src in item.availableSources"
              :key="src"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm transition group-hover:brightness-110"
              :class="sourceStyle(src)"
            >{{ src }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid > div {
  animation: cardFadeIn 0.4s ease-out both;
}
@keyframes cardFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
