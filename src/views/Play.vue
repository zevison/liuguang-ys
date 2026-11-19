<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, Play, Loader2, AlertCircle, ChevronUp, ChevronDown, X, SkipBack, SkipForward, Share } from 'lucide-vue-next'
import { fetchDetailBySource, fetchDetailAny, fetchSearch, type VodItem } from '../api'
import { SOURCES, SOURCE_DISPLAY_ORDER, SOURCE_COLORS } from '../config/sources'
import { addSearchHistory } from '../utils/history'
import HlsPlayer from '../components/HlsPlayer.vue'

// ===== PWA 安装提醒（仅 iOS Safari，非 standalone 模式）=====
const PWA_DISMISS_KEY = 'yj:pwa_dismissed_at'
const isIOS = computed(() => /iPhone|iPad|iPod/.test(navigator.userAgent))
const isStandalone = computed(() =>
  (navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches
)
const showPwaTip = ref(false)
onMounted(() => {
  const dismissedAt = Number(localStorage.getItem(PWA_DISMISS_KEY) || 0)
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  if (isIOS.value && !isStandalone.value && Date.now() - dismissedAt > SEVEN_DAYS) {
    showPwaTip.value = true
  }
})
function dismissPwaTip() {
  showPwaTip.value = false
  localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()))
}

const route = useRoute()
const router = useRouter()

const initialSource = computed(() => (route.query.source as string) || '')
const initialId = computed(() => Number(route.query.id) || 0)

const item = ref<VodItem | null>(null)
const currentSource = ref(initialSource.value)
const loading = ref(true)
const err = ref('')
const activeEp = ref(0)
const sourceIds = ref<Record<string, { id: number; host: string }>>({})

const epSort = ref<1 | -1>(1)

if (route.query.sourceIds && typeof route.query.sourceIds === 'string') {
  try { sourceIds.value = JSON.parse(route.query.sourceIds) } catch { /* ignore */ }
}

const rawEpisodes = computed(() => item.value?.sources[0]?.episodes || [])

const sortedEpisodes = computed(() => {
  const arr = rawEpisodes.value.map((ep, i) => ({ ...ep, originalIndex: i }))
  return epSort.value === -1 ? [...arr].reverse() : arr
})

const currentM3u8 = computed(() => {
  const raw = rawEpisodes.value[activeEp.value]?.url || ''
  const m = raw.match(/^https?:\/\/([^/]+)(.+)$/i)
  if (!m) return raw
  return `/api-proxy/${m[1]}${m[2]}`
})

const availableSourceLabels = computed(() =>
  SOURCE_DISPLAY_ORDER.filter(label => SOURCES.some(s => s.label === label)),
)

const canPrevEp = computed(() => activeEp.value > 0)
const canNextEp = computed(() => activeEp.value + 1 < rawEpisodes.value.length)

function sourceStyle(label: string) {
  return SOURCE_COLORS[label] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}

async function load(sourceLabel: string, id: number) {
  loading.value = true
  err.value = ''
  try {
    const res = await fetchDetailBySource(sourceLabel, id)
    item.value = res.item
    currentSource.value = res.source
    activeEp.value = 0
    epSort.value = 1
  } catch (e: any) {
    err.value = e.message || '加载失败'
    item.value = null
  } finally { loading.value = false }
}

async function tryAutoLoad() {
  if (initialSource.value && initialId.value) {
    await load(initialSource.value, initialId.value)
    if (!err.value) return
  }
  try {
    const res = await fetchDetailAny(initialId.value)
    item.value = res.item
    currentSource.value = res.source
    err.value = ''
    hydrateSourceIds()
  } catch (e: any) {
    err.value = e.message || '所有源均不可用'
  } finally { loading.value = false }
}

async function hydrateSourceIds() {
  const title = item.value?.title
  if (!title) return
  try {
    const res = await fetchSearch(title)
    const hit = res.items.find(it =>
      (it.availableSources || []).includes(currentSource.value)
    )
    if (hit && hit.sourceIds) {
      for (const [lbl, info] of Object.entries(hit.sourceIds)) {
        if (!sourceIds.value[lbl]) {
          sourceIds.value[lbl] = info
        }
      }
    }
  } catch {}
}

async function onSwitchSource(label: string) {
  if (!item.value) return
  loading.value = true
  err.value = ''
  try {
    let idToUse: number
    let hostToUse = ''
    const sourceInfo = sourceIds.value[label]
    if (sourceInfo) {
      idToUse = sourceInfo.id
      hostToUse = sourceInfo.host
    } else {
      const searchRes = await fetchSearch(item.value.title || '')
      const hit = searchRes.items.find(it =>
        (it.availableSources || []).includes(label)
      )
      if (!hit) throw new Error(`${label} 源未收录此剧`)
      const hitSource = hit.sourceIds?.[label]
      if (!hitSource) throw new Error(`${label} 源无此剧的 vod_id`)
      idToUse = hitSource.id
      hostToUse = hitSource.host
      for (const [lbl, info] of Object.entries(hit.sourceIds || {})) {
        sourceIds.value[lbl] = info
      }
    }
    const res = await fetchDetailBySource(label, idToUse)
    item.value = res.item
    currentSource.value = res.source
    activeEp.value = 0
    router.replace({
      name: 'play',
      query: {
        id: String(idToUse),
        source: label,
        title: res.item.title,
        host: hostToUse,
        sourceIds: JSON.stringify(sourceIds.value),
      },
    })
  } catch (e: any) { err.value = e.message || '切换线路失败' }
  finally { loading.value = false }
}

function goSearch() {
  // 正常浏览器返回行为：先尝试 router.back()，没 history 栈时回首页
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace({ name: 'home' })
  }
}

function toggleSort() { epSort.value = epSort.value === 1 ? -1 : 1 }
function selectEp(originalIndex: number) { activeEp.value = originalIndex }

function onPrevEp() {
  if (canPrevEp.value) activeEp.value--
}
function onNextEp() {
  if (canNextEp.value) activeEp.value++
}

const currentEpName = computed(() => rawEpisodes.value[activeEp.value]?.name || '')

function onPlayerEnded() {
  if (activeEp.value + 1 < rawEpisodes.value.length) {
    activeEp.value++
  }
}

onMounted(tryAutoLoad)
</script>

<template>
  <div class="w-full min-w-0 space-y-4 sm:space-y-5">
    <!-- 顶部操作条：返回 + 线路 -->
    <div class="flex items-center justify-between gap-2">
      <button
        class="group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-gray-400 transition hover:border-brand-500/40 hover:text-brand-400 shrink-0 min-h-[36px]"
        @click="goSearch"
      >
        <ChevronLeft class="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
        返回
      </button>

      <!-- 线路切换 -->
      <div v-if="item" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 justify-end" style="touch-action: pan-x pan-y;">
        <span class="mr-1 text-[11px] text-gray-500 shrink-0">线路</span>
        <button
          v-for="label in availableSourceLabels"
          :key="label"
          class="relative rounded-full px-2.5 py-1 text-[11px] transition shrink-0 min-h-[32px]"
          :class="[
            sourceStyle(label),
            currentSource === label
              ? 'ring-1 ring-brand-500/60 text-white shadow-sm shadow-brand-500/20'
              : 'opacity-60 hover:opacity-100',
          ]"
          @click="onSwitchSource(label)"
        >{{ label }}</button>
      </div>
    </div>

    <!-- ========== 平板横屏分栏：lg+ 下播放器左 + 选集右 ========== -->
    <div class="w-full min-w-0 block lg:flex lg:gap-5 lg:items-start">
      <!-- 左侧：播放器 + 标题（占主宽）-->
      <div class="flex-1 min-w-0 space-y-4 sm:space-y-5">
        <!-- 播放器区域 -->
        <div class="relative w-full min-w-0">
          <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-500/10 via-indigo-500/5 to-violet-500/10 opacity-60 blur-lg pointer-events-none" />
          <div class="relative w-full rounded-2xl border border-white/[0.06] bg-black overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,0.6)]">
            <div v-if="loading" class="flex aspect-video items-center justify-center bg-black">
              <div class="flex flex-col items-center gap-3">
                <Loader2 class="h-10 w-10 animate-spin text-brand-500" />
                <div class="text-xs text-gray-500">加载中...</div>
              </div>
            </div>

            <div v-else-if="err" class="aspect-video flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black to-black/80 text-center">
              <AlertCircle class="mb-2 h-8 w-8 text-red-400" />
              <p class="text-sm text-red-400">{{ err }}</p>
              <div class="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  v-for="label in availableSourceLabels"
                  :key="label"
                  class="rounded-full px-3 py-1 text-xs transition hover:opacity-80 min-h-[32px]"
                  :class="sourceStyle(label)"
                  @click="onSwitchSource(label)"
                >切换到 {{ label }}</button>
              </div>
            </div>

            <template v-else-if="item">
              <HlsPlayer :src="currentM3u8" :poster="item.cover || ''" @ended="onPlayerEnded" @prevEp="onPrevEp" @nextEp="onNextEp" />
            </template>
          </div>

          <!-- iOS 音量物理键提示（iOS Safari 禁止 JS 控制 volume） -->
          <transition name="pwa-fade">
            <div
              v-if="isIOS"
              class="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80"
            >
              <ChevronUp class="h-3 w-3 text-amber-400 shrink-0" />
              <span class="truncate">音量请用 iPhone 物理键 ↑↓（iOS Safari 限制）</span>
            </div>
          </transition>
        </div>

        <!-- PWA 安装提醒（仅 iOS Safari） -->
        <transition name="pwa-fade">
          <div
            v-if="showPwaTip"
            class="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-3 py-2.5 text-xs backdrop-blur-sm"
          >
            <Share class="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div class="flex-1 min-w-0 leading-relaxed">
              <div class="text-amber-300 font-medium mb-0.5">建议"添加到主屏幕" 📱</div>
              <div class="text-amber-100/70">
                Safari 下方
                <Share class="inline-block h-3 w-3 align-middle mx-0.5 text-amber-300" />
                → 添加到主屏幕 → 从图标打开 = 无地址栏 + 手势全可用
              </div>
            </div>
            <button
              class="shrink-0 text-amber-400/60 hover:text-amber-300 p-0.5"
              @click="dismissPwaTip"
            ><X class="h-3.5 w-3.5" /></button>
          </div>
        </transition>

        <!-- 标题 + 上下集 -->
        <template v-if="item">
          <div class="space-y-2">
            <!-- 标题 + 源标签 + 上下集 -->
            <div class="flex items-center gap-2 flex-wrap">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <h1 class="text-base sm:text-lg font-semibold text-white truncate">{{ item.title }}</h1>
                <span v-if="currentSource" class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm" :class="sourceStyle(currentSource)">
                  {{ currentSource }}
                </span>
              </div>

              <!-- 上一集 / 下一集 -->
              <div class="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  class="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-gray-300 transition hover:border-brand-500/40 hover:text-brand-400 min-h-[28px] disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-gray-300"
                  :disabled="!canPrevEp"
                  @click="onPrevEp"
                >
                  <SkipBack class="h-3 w-3" />
                  <span class="hidden sm:inline">上一集</span>
                </button>
                <button
                  class="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-gray-300 transition hover:border-brand-500/40 hover:text-brand-400 min-h-[28px] disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:text-gray-300"
                  :disabled="!canNextEp"
                  @click="onNextEp"
                >
                  <span class="hidden sm:inline">下一集</span>
                  <SkipForward class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- 第二行：播放状态 -->
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span class="inline-flex items-center gap-1">
                <Play class="h-3 w-3 text-brand-400" />
                正在播放 <span class="text-brand-300">{{ currentEpName }}</span>
              </span>
              <span v-if="item.update">{{ item.update }}</span>
              <span v-if="item.year">{{ item.year }}</span>
            </div>
          </div>
        </template>
      </div>
      <!-- /左侧 flex-1 结束 -->

      <!-- 右侧：选集面板（lg+ 平板横屏时作为侧边栏，小屏在下方）-->
      <div v-if="item && rawEpisodes.length" class="w-full mt-4 lg:mt-0 lg:w-[300px] xl:w-[340px] lg:shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-3 sm:p-4 lg:sticky lg:top-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white">
            选集
            <span class="ml-2 text-xs font-normal text-gray-500">{{ rawEpisodes.length }} 集</span>
          </h2>
          <button
            v-if="rawEpisodes.length > 5"
            class="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-gray-400 transition hover:border-brand-500/40 hover:text-brand-400 min-h-[28px]"
            @click="toggleSort"
          >
            <template v-if="epSort === 1">
              <ChevronUp class="h-3 w-3" /> 正序
            </template>
            <template v-else>
              <ChevronDown class="h-3 w-3" /> 倒序
            </template>
          </button>
        </div>

        <div
          class="ep-grid grid max-h-64 overflow-y-auto gap-1.5 sm:gap-2 sm:max-h-72 lg:max-h-[calc(100vh-180px)] grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-3 xl:grid-cols-4"
        >
          <button
            v-for="ep in sortedEpisodes"
            :key="ep.originalIndex"
            class="group relative rounded-lg px-1.5 py-2 sm:px-2 text-[11px] sm:text-xs transition active:scale-95 min-h-[36px]"
            :class="[
              ep.originalIndex === activeEp
                ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/30 ring-1 ring-brand-400/50'
                : 'bg-white/[0.05] text-gray-300 hover:bg-white/[0.1] hover:text-white',
            ]"
            @click="selectEp(ep.originalIndex)"
          >
            <Play
              v-if="ep.originalIndex === activeEp"
              class="absolute left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 text-white"
            />
            {{ ep.name }}
          </button>
        </div>
      </div>
    </div>
    <!-- /平板横屏分栏 外层 flex 结束 -->
  </div>
</template>

<style scoped>
.pwa-fade-enter-active, .pwa-fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.pwa-fade-enter-from, .pwa-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
