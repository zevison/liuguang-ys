import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/Home.vue') },
  { path: '/search', name: 'search', component: () => import('./views/Search.vue') },
  { path: '/play', name: 'play', component: () => import('./views/Play.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
