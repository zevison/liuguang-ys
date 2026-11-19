<template>
  <!-- Skip Link: 键盘用户跳过导航直达主内容 -->
  <a href="#main-content" class="skip-link">跳过导航 → 直接进入内容</a>

  <!-- 终极滚动容器：绕开 vivo/QQ/华为浏览器的 html/body overflow:hidden 注入 -->
  <div id="__scroll__" class="text-ink-text bg-hero-gradient">
    <main
      id="main-content"
      class="mx-auto w-full max-w-7xl px-3 pb-20 pt-3 sm:px-5 sm:pb-24 sm:pt-4 lg:px-8"
      :style="{
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
        paddingLeft: 'max(env(safe-area-inset-left), 0.75rem)',
        paddingRight: 'max(env(safe-area-inset-right), 0.75rem)',
      }"
      tabindex="-1"
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
  transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
