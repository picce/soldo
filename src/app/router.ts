import type { RouteLocationNormalized, Router, RouteRecordRaw, RouterHistory } from 'vue-router'
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
    path: '/impostazioni/categorie',
    name: 'categories',
    component: () => import('@/features/categories/CategoriesView.vue'),
    meta: { titleKey: 'categories.title', fullscreen: true },
  },
  {
    path: '/impostazioni/categorie/:id',
    name: 'category-edit',
    component: () => import('@/features/categories/CategoryEditView.vue'),
    props: route => ({
      id: route.params.id === 'nuova'
        ? null
        : route.params.id,
      kind: route.query.tipo === 'entrate'
        ? 'income'
        : 'expense',
    }),
    meta: {
      titleKey: route => route.params.id === 'nuova'
        ? 'categoryEdit.new'
        : 'categoryEdit.edit',
      fullscreen: true,
    },
  },
  {
    path: '/nuovo/:kind(uscita|entrata)',
    name: 'transaction-new',
    component: () => import('@/features/transactions/TransactionEditorView.vue'),
    props: route => ({
      target: {
        mode: 'new',
        kind: route.params.kind === 'entrata'
          ? 'income'
          : 'expense',
      },
    }),
    meta: {
      titleKey: route => route.params.kind === 'entrata'
        ? 'editor.newIncome'
        : 'editor.newExpense',
      fullscreen: true,
    },
  },
  {
    path: '/movimenti/:id',
    name: 'transaction-edit',
    component: () => import('@/features/transactions/TransactionEditorView.vue'),
    props: route => ({
      target: { mode: 'edit', id: route.params.id },
    }),
    meta: { titleKey: 'editor.edit', fullscreen: true },
  },
  {
    path: '/benvenuto',
    name: 'welcome',
    component: () => import('@/features/onboarding/WelcomeView.vue'),
    meta: { fullscreen: true },
  },
  // Internal page with every component, in light and dark: development only.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/ui',
          name: 'dev-ui',
          component: () => import('@/features/dev/DevUiView.vue'),
        },
      ]
    : []),
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'home' },
  },
]

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    // Back from the edit screen, the list returns where it was: the rows come from
    // IndexedDB, so the position is restored once they have had a moment to render.
    scrollBehavior: (_to, _from, saved) => saved
      ? new Promise(resolve => setTimeout(resolve, 120, saved))
      : { top: 0 },
  })

  function updateTitle(route: RouteLocationNormalized) {
    const appName = i18n.global.t('app.name')
    const { titleKey } = route.meta
    const key = typeof titleKey === 'function'
      ? titleKey(route)
      : titleKey
    document.title = key && route.name !== 'home'
      ? `${i18n.global.t(key)} · ${appName}`
      : appName
  }

  router.afterEach(to => updateTitle(to))
  // The title follows the language too, which can change without navigating.
  watch(i18n.global.locale, () => updateTitle(router.currentRoute.value))

  return router
}

/**
 * Until the first start is done, every page leads to the welcome, and the welcome leads
 * to the Home afterwards (docs/specs/onboarding.md). Installed by main.ts, not by
 * createAppRouter, so page tests do not go through it.
 */
export function requireOnboarding(router: Router) {
  router.beforeEach(async (to) => {
    if (to.name === 'dev-ui')
      return true
    const { isOnboarded } = await import('@/app/onboarding')
    const done = await isOnboarded()
    if (to.name === 'welcome') {
      return done
        ? { name: 'home' }
        : true
    }
    return done
      ? true
      : { name: 'welcome' }
  })
}
