import { createRouter, createWebHistory } from 'vue-router'
import Inicio from './views/Inicio.vue'

export const pages = [
  { path: '/', name: 'inicio', label: 'Início', icon: '🏠', component: Inicio },
  { path: '/rancho', name: 'rancho', label: 'Rancho', icon: '🛒', component: () => import('./views/Rancho.vue') },
  { path: '/produtos', name: 'produtos', label: 'Produtos', icon: '🏷️', component: () => import('./views/Produtos.vue') },
  { path: '/despesas', name: 'despesas', label: 'Despesas', icon: '📅', component: () => import('./views/Despesas.vue') },
  { path: '/resumo', name: 'resumo', label: 'Resumo', icon: '📊', component: () => import('./views/Resumo.vue') },
  { path: '/definicoes', name: 'definicoes', label: 'Definições', icon: '⚙️', component: () => import('./views/Definicoes.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...pages.map(({ path, name, component, label }) => ({ path, name, component, meta: { title: label } })),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  document.title = to.meta.title && !['inicio', 'rancho'].includes(to.name) ? `${to.meta.title} · Rancho` : 'Rancho'
})
