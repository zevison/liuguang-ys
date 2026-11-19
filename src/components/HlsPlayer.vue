<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import sniffer from 'xgplayer/es/utils/sniffer.js'
import Player from 'xgplayer'
import MobilePreset from 'xgplayer/es/presets/mobile'
import HlsPlugin from 'xgplayer-hls'
import 'xgplayer/dist/index.min.css'

const props = defineProps<{
  src: string
  poster?: string
}>()

const emit = defineEmits<{
  (e: 'error', message: string): void
  (e: 'ended'): void
  (e: 'prevEp'): void
  (e: 'nextEp'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let player: any = null

// ===== 设备检测 =====
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const IS_IOS = /iPhone|iPad|iPod/.test(UA)

// ===== 续播记忆 =====
const MEMORY_PREFIX = 'yj:playpos:'
let saveTimer: ReturnType<typeof setInterval> | null = null
function clearSaveTimer() { if (saveTimer) { clearInterval(saveTimer); saveTimer = null } }
function savePosition(url: string, pos: number) { try { localStorage.setItem(MEMORY_PREFIX + url, String(pos)) } catch {} }
function loadPosition(url: string): number { try { return Number(localStorage.getItem(MEMORY_PREFIX + url)) || 0 } catch { return 0 } }
function clearOldMemory() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(MEMORY_PREFIX))
    if (keys.length > 50) {
      keys.sort().slice(0, keys.length - 50).forEach(k => localStorage.removeItem(k))
    }
  } catch {}
}

function destroyPlayer() {
  clearSaveTimer()
  if (player) {
    try {
      if (player.video?.currentTime > 0 && !player.video?.ended) savePosition(props.src, player.video.currentTime)
    } catch {}
    try { player.destroy() } catch {}
    player = null
  }
}

async function init() {
  destroyPlayer()
  await nextTick()
  if (!containerRef.value || !props.src) return

  clearOldMemory()
  const savedPos = loadPosition(props.src)

  player = new Player({
    el: containerRef.value,
    url: props.src,
    preset: MobilePreset,
    plugins: [HlsPlugin],
    hlsPlugin: {},
    poster: props.poster || '',

    volume: 0.8,
    muted: false,
    autoplay: true,
    playsinline: true,
    webkitPlaysinline: true,

    // rotateFullscreen = CSS 全屏 + 旋转 90°（DOM 全保留，手势全可用）
    // needBackIcon = 全屏后顶部显示返回按钮
    fullscreen: {
      rotateFullscreen: true,
      needBackIcon: true,
    },
    miniProgressBar: true,

    // mobile 手势：
    // scopeL=0.5 左半屏亮度, scopeR=0.5 右半屏音量
    // sniffer.os.isIos 已在 main.ts 被 patch 为 false → 音量分支也会跑
    mobile: {
      scopeL: 0.5,
      scopeR: 0.5,
      darkness: true,
      maxDarkness: 0.7,
      disablePress: false,
      pressRate: 2,
      gestureX: true,
      gestureY: true,
      isTouchingSeek: true,
    },

    width: '100%',
    height: '100%',
  })

  player.on('ready', () => {
    if (savedPos > 0 && savedPos < (player.duration || 0) - 2) {
      try { player.seek(savedPos) } catch {}
    }
    try { player.play() } catch {}

    // ===== 关键诊断：验证 sniffer patch 是否真的传到了 mobile 插件 =====
    const mobile: any = player?.getPlugin('mobile')
    const snifferAtReady = sniffer.os.isIos  // 此时 mobile 插件应该已 import 同一个 sniffer 实例
    console.log('[HlsPlayer] ready ✅', {
      IS_IOS_device: IS_IOS,
      sniffer_os_isIos: snifferAtReady,
      mobile_scopeL: mobile?.config?.scopeL,
      mobile_scopeR: mobile?.config?.scopeR,
      rotateFullscreen: 'rotateFullscreen',
      // 如果 sniffer_os_isIos = false 但 IS_IOS_device = true → patch 生效了 ✅
    })
  })

  player.on('play', () => {
    clearSaveTimer()
    saveTimer = setInterval(() => {
      if (player?.video?.currentTime > 0) savePosition(props.src, player.video.currentTime)
    }, 5000)
  })

  player.on('pause', () => { if (player?.video) savePosition(props.src, player.video.currentTime) })
  player.on('ended', () => { clearSaveTimer(); emit('ended') })
  player.on('error', () => emit('error', '播放出错，请尝试切换线路'))

  // ===== Capacitor StatusBar 集成（Android App 全屏时隐藏状态栏）=====
  // window.Capacitor 只在原生 App 里存在，Web/PWA 不影响
  const C = (window as any).Capacitor
  const StatusBar = C?.Plugins?.StatusBar
  let wasFullscreen = false
  player.on('fullscreen', (isFs: boolean) => {
    if (!StatusBar) return
    try {
      if (isFs && !wasFullscreen) {
        // 进入全屏
        StatusBar.hide()
        StatusBar.setBackgroundColor({ color: '#000000' })
        StatusBar.setOverlaysWebView({ overlay: true })
      } else if (!isFs && wasFullscreen) {
        // 退出全屏
        StatusBar.show()
        StatusBar.setBackgroundColor({ color: '#000000' })
        StatusBar.setOverlaysWebView({ overlay: false })
      }
      wasFullscreen = isFs
    } catch (e) { /* Web 环境下 StatusBar 不存在，忽略 */ }
  })
}

watch(() => props.src, () => { init() }, { immediate: true })
onBeforeUnmount(() => { destroyPlayer() })

defineExpose({
  pause: () => player?.pause(),
  play: () => player?.play(),
})
</script>

<template>
  <div class="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
    <div ref="containerRef" class="absolute inset-0 bg-black" />
  </div>
</template>

<style>
.xgplayer {
  --xg-color: #fff !important;
  --xg-primary: #3b82f6 !important;
  --xg-secondary: rgba(255, 255, 255, 0.5) !important;
}

.xgplayer-mobile {
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

/* ========== 根因修复：移除全屏暗角渐变 ==========
   xgplayer mobile preset 自带 .gradient 层覆盖整个视频画面，
   在 xgplayer-playing 时显示 top→bottom 0.6→0→0.6 透明黑渐变。
   这就是用户看到的"半透明黑框"——不是控制栏的局部渐变，
   而是铺满整个视频区域的暗角。控制栏自身有独立的 48px 渐变，
   不需要这个额外的全屏暗角。
*/
.xgplayer .gradient {
  display: none !important;
  background-image: none !important;
}

/* ========== rotateFullscreen 修正 ========== */

/* 全屏后移除安全区 padding，让视频铺满 */
.xgplayer-rotate-fullscreen {
  padding: 0 !important;
  margin: 0 !important;
}

/* 进度条在 rotateFullscreen 下被旋转 90° 变成纵向 → 强制回正 */
.xgplayer-rotate-fullscreen .xg-controls .xg-progress {
  transform: none !important;
  position: absolute !important;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100% !important;
  height: 3px;
}

/* 全屏下控制栏也回正 */
.xgplayer-rotate-fullscreen .xg-controls {
  transform: none !important;
  width: 100% !important;
}

/* 全屏下 time 显示回正 */
.xgplayer-rotate-fullscreen .xg-time {
  transform: none !important;
}
</style>
