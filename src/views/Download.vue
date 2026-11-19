<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Download, Smartphone, Monitor, Apple, CheckCircle, ArrowRight, Home } from 'lucide-vue-next'

const router = useRouter()

const ASSETS = {
  APK: 'https://github.com/zevison/liuguang-ys/releases/download/v1.0.0/app-release.apk',
  EXE: 'https://github.com/zevison/liuguang-ys/releases/download/v1.0.0/liuguang-setup.exe',
  WEB: 'https://tv.szdapi.com',
}
</script>

<template>
  <div class="mx-auto max-w-2xl py-6">
    <!-- 标题 -->
    <div class="mb-6 text-center">
      <h1 class="text-xl font-bold text-white sm:text-2xl">下载映界</h1>
      <p class="mt-1.5 text-sm text-gray-400">选一个设备，轻松搞定</p>
    </div>

    <!-- Android -->
    <section
      class="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-5"
    >
      <div class="mb-3 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400"
        >
          <Smartphone class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-white">安卓手机 / 平板</h2>
          <p class="text-xs text-gray-400">一键安装 · 3.4 MB</p>
        </div>
      </div>

      <a
        :href="ASSETS.APK"
        class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-medium text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 active:scale-[0.98]"
      >
        <Download class="h-5 w-5" />
        下载安装包
      </a>

      <details class="group rounded-xl bg-black/20">
        <summary
          class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white"
        >
          <span class="font-medium">不会装？点我看步骤</span>
          <span class="text-gray-500 transition group-open:rotate-180">▾</span>
        </summary>
        <ol class="space-y-2 border-t border-white/5 px-4 py-3 text-sm text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            点上面的按钮，下载安装包到手机
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            打开文件管理器，找到刚下的文件（一般在"下载"文件夹）
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            第一次装外部应用，手机可能提示"允许此来源"，点允许就行
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            一路"安装" → "打开"，就能看片啦
          </li>
        </ol>
      </details>
    </section>

    <!-- Windows -->
    <section
      class="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-sky-500/[0.08] to-sky-500/[0.02] p-5"
    >
      <div class="mb-3 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400"
        >
          <Monitor class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-white">Windows 电脑</h2>
          <p class="text-xs text-gray-400">安装向导 · 2.7 MB</p>
        </div>
      </div>

      <a
        :href="ASSETS.EXE"
        class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-medium text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 active:scale-[0.98]"
      >
        <Download class="h-5 w-5" />
        下载安装包
      </a>

      <details class="group rounded-xl bg-black/20">
        <summary
          class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white"
        >
          <span class="font-medium">不会装？点我看步骤</span>
          <span class="text-gray-500 transition group-open:rotate-180">▾</span>
        </summary>
        <ol class="space-y-2 border-t border-white/5 px-4 py-3 text-sm text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            下载安装包到电脑
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            双击运行。如果弹提示框，点"更多信息 → 仍要运行"
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            跟着向导点下一步就行
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            桌面会出现映界图标，双击打开
          </li>
        </ol>
      </details>
    </section>

    <!-- iOS -->
    <section
      class="mb-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-gray-500/[0.08] to-gray-500/[0.02] p-5"
    >
      <div class="mb-3 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-500/20 text-gray-300"
        >
          <Apple class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-white">iPhone / iPad</h2>
          <p class="text-xs text-gray-400">浏览器直接用，无需下载</p>
        </div>
      </div>

      <a
        :href="ASSETS.WEB"
        target="_blank"
        class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-500 px-6 py-3 font-medium text-white shadow-lg shadow-gray-500/30 transition hover:bg-gray-400 active:scale-[0.98]"
      >
        <Apple class="h-5 w-5" />
        打开映界网页版
      </a>

      <details class="group rounded-xl bg-black/20">
        <summary
          class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white"
        >
          <span class="font-medium">想放到桌面？点我</span>
          <span class="text-gray-500 transition group-open:rotate-180">▾</span>
        </summary>
        <ol class="space-y-2 border-t border-white/5 px-4 py-3 text-sm text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            用 Safari 打开 <span class="text-gray-200">tv.szdapi.com</span>
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            点底部的分享按钮（方框向上箭头那个）
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            往下滑，选"添加到主屏幕"
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            桌面上就有映界图标啦，点开像 App 一样用
          </li>
        </ol>
      </details>
    </section>

    <!-- 返回首页 -->
    <button
      class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
      @click="router.push({ name: 'home' })"
    >
      <Home class="h-4 w-4" />
      返回首页
    </button>
  </div>
</template>
