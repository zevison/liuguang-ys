<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Film, Flame, Sparkles, Clock, X } from 'lucide-vue-next'
import { fetchHotTop, fetchHotKeywords, type HotItem } from '../api'
import VideoCard from '../components/VideoCard.vue'
import { getSearchHistory, addSearchHistory, clearSearchHistory } from '../utils/history'

const router = useRouter()
const wd = ref('')
const popular = ref<HotItem[]>([])
const loading = ref(true)
const err = ref('')
const hotWords = ref<string[]>([])
const history = ref<string[]>([])

function onSearch(kw?: string) {
  const q = (kw ?? wd.value).trim()
  if (!q) return
  addSearchHistory(q)
  router.push({ name: 'search', query: { q } })
}

function onClearHistory() {
  clearSearchHistory()
  history.value = []
}

function onRemoveHistoryItem(item: string) {
  const list = history.value.filter(x => x !== item)
  try { localStorage.setItem('search_history_v1', JSON.stringify(list)) } catch {}
  history.value = list
}

onMounted(async () => {
  // 立即渲染的部分：搜索框 + 历史（不依赖异步）
  history.value = getSearchHistory()

  // 热搜词：优先显示（独立请求，不绑热门卡片）
  fetchHotKeywords(6).then(res => {
    hotWords.value = res
  }).catch(() => {})

  // 热门卡片：骨架屏 → 替换（独立请求，不等热搜）
  fetchHotTop(6).then(res => {
    popular.value = res.items
  }).catch((e) => {
    err.value = e?.message || '加载失败'
  }).finally(() => {
    loading.value = false
  })
})
</script>

<template>
  <div class="w-full min-w-0 space-y-10 sm:space-y-14 animate-fade-in">
    <!-- Hero 搜索区 -->
    <section class="relative overflow-hidden pt-14 pb-2 sm:pt-24 sm:pb-4">
      <!-- 背景光晕（手机上缩小防撑宽）-->
      <div class="pointer-events-none absolute top-0 left-1/2 h-[280px] w-[280px] -translate-x-1/2 translate-y-[-40%] rounded-full bg-brand-500/10 blur-[100px] sm:h-[400px] sm:w-[600px] sm:blur-[120px]" />
      <div class="pointer-events-none absolute top-16 right-[-40px] h-[140px] w-[140px] rounded-full bg-indigo-500/10 blur-[60px] sm:top-20 sm:right-0 sm:h-[200px] sm:w-[200px]" />
      <div class="pointer-events-none absolute -bottom-10 left-[-40px] h-[120px] w-[120px] rounded-full bg-violet-500/8 blur-[50px] sm:left-0 sm:h-[180px] sm:w-[180px]" />

      <div class="relative mx-auto w-full max-w-xl animate-slide-up px-3 sm:px-0">
        <!-- Logo + 标题 -->
        <div class="mb-4 sm:mb-6 flex items-center justify-center gap-3">
          <div class="relative">
            <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 opacity-60 blur-md" />
            <div class="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/40 ring-1 ring-white/10">
              <Film class="h-5 w-5 text-white" />
            </div>
          </div>
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            <span class="bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent">映界</span>
          </h1>
          <Sparkles class="h-4 w-4 text-brand-400" />
        </div>
        <p class="mb-6 sm:mb-8 text-center text-xs sm:text-sm text-gray-400">
          多源聚合 · 极速播放 · 一键搜索全网
        </p>

        <!-- 搜索框（多层玻璃态 + 光环）-->
        <div class="relative">
          <div class="absolute -inset-0.5 rounded-full bg-gradient-to-r from-brand-500/30 via-indigo-500/20 to-violet-500/30 opacity-60 blur-sm" />
          <form
            class="group relative flex items-stretch gap-0 rounded-full overflow-hidden bg-white/[0.06] backdrop-blur-xl ring-1 ring-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-colors transition-shadow focus-within:ring-brand-500/40 focus-within:shadow-[0_8px_48px_rgba(59,130,246,0.15)]"
            @submit.prevent="onSearch()"
          >
            <div class="relative flex-1 min-w-0">
              <Search class="pointer-events-none absolute left-4 sm:left-5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-brand-400" />
              <input
                v-model="wd"
                type="text"
                inputmode="search"
                enterkeyhint="search"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="输入剧名、电影名、演员..."
                class="w-full min-w-0 rounded-l-full bg-transparent py-3.5 pl-11 sm:pl-14 pr-3 sm:pr-4 text-[16px] sm:text-base text-gray-200 placeholder:text-gray-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              class="flex-none rounded-r-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 sm:px-7 text-xs sm:text-sm font-medium text-white transition hover:from-brand-400 hover:to-brand-500 active:scale-[0.98] shadow-inner shadow-white/10 whitespace-nowrap"
            >
              搜索
            </button>
          </form>
        </div>

        <!-- 搜索历史 -->
        <div v-if="history.length" class="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1.5 px-2">
          <div class="flex items-center gap-1 shrink-0">
            <Clock class="h-3 w-3 text-gray-600" />
            <span class="text-[11px] text-gray-500">历史</span>
          </div>
          <template v-for="(h, i) in history" :key="h">
            <span class="text-gray-800 text-xs">·</span>
            <div class="group/hist inline-flex items-center gap-0.5 rounded-full bg-white/[0.04] px-2 py-0.5">
              <button
                class="cursor-pointer text-xs text-gray-400 transition-colors hover:text-gray-200"
                @click="onSearch(h)"
              >{{ h }}</button>
              <button
                class="opacity-0 transition-opacity group-hover/hist:opacity-100 text-gray-600 hover:text-gray-300"
                @click.stop="onRemoveHistoryItem(h)"
                aria-label="删除"
              ><X class="h-2.5 w-2.5" /></button>
            </div>
          </template>
          <button
            v-if="history.length"
            class="ml-2 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
            @click="onClearHistory"
          >清空</button>
        </div>
      </div>
    </section>

    <!-- 分割线 -->
    <div class="mx-auto h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

    <!-- 热门 -->
    <section v-if="popular.length || loading" class="px-0">
      <div class="mb-4 sm:mb-5 flex items-center justify-center gap-2.5">
        <div class="h-4 w-1 rounded-full bg-gradient-to-b from-brand-400 to-brand-600" />
        <h2 class="text-base font-semibold tracking-wide text-white">最近热门</h2>
        <span class="text-xs text-gray-500">· 实时更新</span>
      </div>

      <div v-if="loading" class="grid mx-auto grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 max-w-5xl">
        <div v-for="i in 6" :key="i" class="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.04] ring-1 ring-white/[0.04]" />
      </div>

      <div v-else-if="popular.length" class="grid mx-auto grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 max-w-5xl">
        <VideoCard
          v-for="(item, i) in popular"
          :key="item.id"
          v-bind="item"
          :style="{ animationDelay: `${Math.min(i * 35, 300)}ms` }"
          class="animate-slide-up"
        />
      </div>

      <!-- 热搜词（移到热门下方，主路径不抢戏）-->
      <div v-if="hotWords.length" class="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
        <div class="flex items-center gap-1 shrink-0">
          <Flame class="h-3.5 w-3.5 text-brand-500" />
          <span class="text-xs font-medium text-brand-500">大家都在搜</span>
        </div>
        <template v-for="(w, i) in hotWords" :key="i">
          <span class="text-gray-700 text-xs">·</span>
          <button
            class="cursor-pointer text-xs text-gray-400 transition-colors hover:text-brand-400 hover:underline decoration-dotted underline-offset-4"
            @click="onSearch(w)"
          >{{ w }}</button>
        </template>
      </div>
    </section>

    <!-- 底部装饰 -->
    <div class="py-6 text-center text-[11px] text-gray-600">
      <span class="opacity-60">映界 · 多源影视聚合</span>
    </div>
  </div>
</template>
