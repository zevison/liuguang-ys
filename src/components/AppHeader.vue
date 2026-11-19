<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search, Film, Home, X, Download } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const wd = ref('')

function goHome() {
  if (route.name !== 'home') {
    router.push({ name: 'home' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function goDownload() {
  router.push({ name: 'download' })
}

function onSearch() {
  const q = wd.value.trim()
  if (!q) return
  wd.value = ''
  router.push({ name: 'search', query: { q } })
}

const showSearch = computed(() => route.name !== 'home')
const isDownloadPage = computed(() => route.name === 'download')

import { ref } from 'vue'
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-bg/80 backdrop-blur-xl backdrop-saturate-150"
    :style="{ paddingTop: 'env(safe-area-inset-top)' }"
  >
    <div class="mx-auto flex h-14 items-center gap-3 px-3 sm:px-5 lg:px-8">
      <!-- Logo / 首页按钮 -->
      <button
        class="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-ink-text transition hover:bg-white/[0.06] active:scale-95"
        @click="goHome"
        aria-label="返回首页"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 shadow-lg shadow-brand-500/30 transition group-hover:scale-105"
        >
          <Film class="h-4 w-4 text-white" />
        </div>
        <span class="hidden text-base font-bold tracking-wide text-white sm:block">映界</span>
      </button>

      <!-- 全局搜索框（非首页 & 非下载页显示）-->
      <div v-if="showSearch && !isDownloadPage" class="relative flex-1 max-w-xl">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
        <input
          v-model="wd"
          @keyup.enter="onSearch"
          type="search"
          placeholder="搜索影视..."
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          class="w-full rounded-full border border-white/10 bg-ink-card/60 py-2 pl-9 pr-9 text-sm text-ink-text placeholder:text-gray-500 outline-none ring-brand-500/0 transition focus:border-brand-500/60 focus:bg-ink-card focus:ring-2 focus:ring-brand-500/30"
        />
        <button
          v-if="wd"
          class="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
          @click="wd = ''"
          aria-label="清除"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- 首页/下载页的"回到顶部"按钮占位 -->
      <div v-else class="flex-1" />

      <!-- 右上角下载按钮（所有页面都显示）-->
      <button
        class="flex h-9 items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 text-sm font-medium text-brand-400 transition hover:border-brand-500/60 hover:bg-brand-500/20 hover:text-brand-300 active:scale-95"
        :class="{ 'ring-2 ring-brand-500/40': isDownloadPage }"
        @click="goDownload"
      >
        <Download class="h-3.5 w-3.5" />
        <span>下载</span>
      </button>
    </div>
  </header>
</template>
