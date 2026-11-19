<template>
  <!-- 终极滚动容器：绕开 vivo/QQ/华为浏览器的 html/body overflow:hidden 注入
       外层锁死 → 内层 #__scroll__ 做真正的滚动 -->
  <div id="__scroll__" class="text-gray-200 bg-hero-gradient">
    <main
      class="mx-auto w-full max-w-7xl px-3 pb-20 pt-3 sm:px-5 sm:pb-24 sm:pt-4 lg:px-8"
      :style="{
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
        paddingLeft: 'max(env(safe-area-inset-left), 0.75rem)',
        paddingRight: 'max(env(safe-area-inset-right), 0.75rem)',
      }"
    >
      <div class="w-full max-w-full min-w-0">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" class="w-full max-w-full min-w-0" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
