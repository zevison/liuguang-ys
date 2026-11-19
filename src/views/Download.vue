<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Download, Smartphone, Monitor, Apple, Shield, CheckCircle, ArrowRight, Home } from 'lucide-vue-next'

const router = useRouter()

const ASSETS = {
  APK: 'https://github.com/zevison/liuguang-ys/releases/download/v1.0.0/app-release.apk',
  EXE: 'https://github.com/zevison/liuguang-ys/releases/download/v1.0.0/liuguang-setup.exe',
  WEB: 'https://tv.szdapi.com',
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-8">
    <!-- 标题 -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-white sm:text-3xl">下载映界</h1>
      <p class="mt-2 text-sm text-gray-400 sm:text-base">
        选择你的设备，一键安装映界影视 App
      </p>
    </div>

    <!-- Android -->
    <section
      class="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] p-5"
    >
      <div class="mb-4 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400"
        >
          <Smartphone class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-white">Android 手机 / 平板</h2>
          <p class="text-xs text-gray-400">APK 安装包 · 原生体验 · 3.38 MB</p>
        </div>
      </div>

      <a
        :href="ASSETS.APK"
        class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-medium text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 active:scale-[0.98]"
      >
        <Download class="h-5 w-5" />
        立即下载 APK
      </a>

      <div class="space-y-2 rounded-xl bg-black/20 p-4 text-sm text-gray-300">
        <p class="mb-2 font-medium text-gray-200">安装步骤：</p>
        <ol class="space-y-2 pl-5 text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            点击上方按钮下载 APK 文件到手机
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            打开文件管理器，找到下载的 APK 文件
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            如果提示"未知来源"，去 <span class="text-gray-200">设置 → 安全</span> 允许安装未知来源应用
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            点击 APK → 安装 → 打开，即可开始使用
          </li>
        </ol>
      </div>

      <div
        class="mt-3 flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3 text-xs text-yellow-200/80"
      >
        <Shield class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          首次安装请信任应用来源。APK 使用自有签名（SHA-256），可在 GitHub Release
          页面校验哈希值。
        </p>
      </div>
    </section>

    <!-- Windows -->
    <section
      class="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-sky-500/[0.08] to-sky-500/[0.02] p-5"
    >
      <div class="mb-4 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400"
        >
          <Monitor class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-white">Windows 电脑</h2>
          <p class="text-xs text-gray-400">NSIS 安装向导 · 原生体验 · 2.70 MB</p>
        </div>
      </div>

      <a
        :href="ASSETS.EXE"
        class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-medium text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 active:scale-[0.98]"
      >
        <Download class="h-5 w-5" />
        立即下载安装包
      </a>

      <div class="space-y-2 rounded-xl bg-black/20 p-4 text-sm text-gray-300">
        <p class="mb-2 font-medium text-gray-200">安装步骤：</p>
        <ol class="space-y-2 pl-5 text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            下载 exe 安装包到电脑
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            双击运行（Windows SmartScreen 可能提示"未知发布者"，点击 <span class="text-gray-200">更多信息 → 仍要运行</span>）
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            按照安装向导选择目录，点击安装
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
            安装完成后桌面上会生成快捷方式，双击打开即可
          </li>
        </ol>
      </div>

      <div
        class="mt-3 flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3 text-xs text-yellow-200/80"
      >
        <Shield class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          首次运行被 SmartScreen 拦截是正常现象（新签名证书信誉积累中）。
          点"更多信息 → 仍要运行"即可。Tauri 2 构建，自带 WebView2 Runtime。
        </p>
      </div>
    </section>

    <!-- iOS -->
    <section
      class="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-gray-500/[0.08] to-gray-500/[0.02] p-5"
    >
      <div class="mb-4 flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-500/20 text-gray-300"
        >
          <Apple class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-white">iPhone / iPad</h2>
          <p class="text-xs text-gray-400">通过浏览器直接访问</p>
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

      <div class="space-y-2 rounded-xl bg-black/20 p-4 text-sm text-gray-300">
        <p class="mb-2 font-medium text-gray-200">使用步骤：</p>
        <ol class="space-y-2 pl-5 text-gray-400">
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            在 Safari 中访问 <span class="text-gray-200">tv.szdapi.com</span>
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            点击底部 <span class="text-gray-200">分享按钮 → 添加到主屏幕</span>
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            桌面上会生成"映界"图标，点击即可以全屏 PWA 方式运行
          </li>
          <li class="flex gap-2"><ArrowRight class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            支持离线缓存、后台播放、原生全屏
          </li>
        </ol>
      </div>

      <div
        class="mt-3 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-xs text-blue-200/80"
      >
        <CheckCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          为什么没有 iOS App Store 版本？苹果要求影视类 App 必须使用官方播放器并接受
          App Store 审核，而映界是多源聚合搜索工具，无法上架。PWA 方案体验接近原生，
          且无需审核。
        </p>
      </div>
    </section>

    <!-- 底部信息 -->
    <div class="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-xs text-gray-500">
      <p>所有版本同源部署 · GitHub Release 自动构建 · v1.0.0</p>
      <a
        href="https://github.com/zevison/liuguang-ys/releases"
        target="_blank"
        class="mt-1 inline-block text-brand-400 hover:text-brand-300"
      >
        在 GitHub 查看所有版本 →
      </a>
    </div>

    <!-- 返回首页 -->
    <button
      class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
      @click="router.push({ name: 'home' })"
    >
      <Home class="h-4 w-4" />
      返回首页
    </button>
  </div>
</template>
