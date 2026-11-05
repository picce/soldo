import type { RouteLocationNormalized, RouteRecordRaw, RouterHistory } from 'vue-router'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '@/i18n'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/features/home/HomeView.vue'),
    meta: { titleKey: 'nav.home' },
  },
  {
    path: '/movimenti',
    name: 'transactions',
    component: () => import('@/features/transactions/TransactionsView.vue'),
    meta: { titleKey: 'nav.transactions' },
  },
  {
    path: '/budget',
    name: 'budget',
    component: () => import('@/features/budgets/BudgetView.vue'),
    meta: { titleKey: 'nav.budget' },
  },
  {
    path: '/statistiche',
    name: 'stats',
    component: () => import('@/features/stats/StatsView.vue'),
    meta: { titleKey: 'nav.stats' },
  },
  {
    path: '/impostazioni',
    name: 'settings',
    component: () => import('@/features/settings/SettingsView.vue'),
    meta: { titleKey: 'nav.settings' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'home' },
  },
]

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({ history, routes })

  function updateTitle(route: RouteLocationNormalized) {
    const appName = i18n.global.t('app.name')
    document.title = route.meta.titleKey && route.name !== 'home'
      ? `${i18n.global.t(route.meta.titleKey)} · ${appName}`
      : appName
  }

  router.afterEach(to => updateTitle(to))
  // The title follows the language too, which can change without navigating.
  watch(i18n.global.locale, () => updateTitle(router.currentRoute.value))

  return router
}
