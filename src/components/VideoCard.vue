<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { SOURCE_COLORS, SOURCE_DISPLAY_ORDER } from '../config/sources'
import { getCoverUrl } from '../api/cover'

const props = defineProps<{
  id: number
  title: string
  cover: string
  availableSources?: string[]
  update?: string
  year?: string
  category?: string
}>()

const router = useRouter()
const imgLoaded = ref(false)
// 两阶段失败回退：代理缩图 → 原始直连 → 文字占位
const coverStage = ref<'proxy' | 'direct' | 'placeholder'>('proxy')

const safeCover = computed(() => {
  const orig = props.cover || ''
  if (!orig || coverStage.value === 'placeholder') return ''
  if (!/^https?:\/\//i.test(orig) && !orig.startsWith('/api-proxy/')) return ''
  if (coverStage.value === 'direct') return orig
  return getCoverUrl(orig)
})

watch(() => props.cover, () => { imgLoaded.value = false; coverStage.value = 'proxy' })

const shownSources = computed(() => {
  if (!props.availableSources?.length) return []
  return SOURCE_DISPLAY_ORDER.filter(s => props.availableSources!.includes(s))
})

function goPlay() {
  router.push({ name: 'play', query: { id: String(props.id), title: props.title } })
}

function onCoverError() {
  if (coverStage.value === 'proxy') {
    coverStage.value = 'direct'
  } else {
    coverStage.value = 'placeholder'
  }
}
</script>

<template>
  <button class="group relative w-full text-left transition" @click="goPlay">
    <!-- 封面 -->
    <div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-ink-card ring-1 ring-white/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.5)] transition duration-300 group-hover:ring-brand-500/60 group-hover:shadow-[0_8px_32px_rgba(225,29,72,0.2)] group-hover:-translate-y-0.5">
      <template v-if="safeCover">
        <!-- 图片骨架屏（加载中显示）-->
        <div v-if="!imgLoaded" class="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.04] to-white/[0.08]" />
        <img
          :src="safeCover"
          :alt="title"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          @load="imgLoaded = true"
          @error="onCoverError"
          class="h-full w-full object-cover object-[center_top] transition duration-500 group-hover:scale-[1.06]"
          :class="imgLoaded ? 'opacity-100' : 'opacity-0'"
        />
        <!-- hover 渐变遮罩 + 播放图标（仅桌面鼠标设备显示，iOS Safari 触摸会冻结 hover 状态）-->
        <div
          class="pointer-events-none absolute inset-0 hidden items-center justify-center bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition duration-300 md:flex md:group-hover:opacity-100"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/90 text-white shadow-lg shadow-brand-500/40 ring-4 ring-white/10 transition duration-300 md:group-hover:scale-110"
          >
            <svg class="h-5 w-5 translate-x-[2px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </template>
      <!-- 无封面占位 -->
      <template v-else>
        <div
          class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ink-muted to-ink-card text-2xl font-bold tracking-wider text-gray-600"
        >
          {{ title.slice(0, 2) }}
        </div>
      </template>

      <!-- 右上角 source tag（搜索结果才有）-->
      <div v-if="shownSources.length" class="absolute top-1.5 right-1.5 flex gap-1">
        <span
          v-for="s in shownSources.slice(0, 3)"
          :key="s"
          class="rounded px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm"
          :class="SOURCE_COLORS[s]?.bg + ' ' + SOURCE_COLORS[s]?.text"
        >{{ s }}</span>
        <span
          v-if="shownSources.length > 3"
          class="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm"
        >+{{ shownSources.length - 3 }}</span>
      </div>

      <!-- 底部更新信息（有就显示）-->
      <div v-if="update" class="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
        {{ update }}
      </div>
    </div>

    <!-- 标题 -->
    <div class="mt-2 px-0.5">
      <h3
        class="truncate text-sm font-medium leading-tight text-gray-200 transition-colors group-hover:text-white"
        :title="title"
      >{{ title }}</h3>
    </div>
  </button>
</template>
