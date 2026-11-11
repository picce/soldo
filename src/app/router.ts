import type { RouteLocationNormalized, Router, RouteRecordRaw, RouterHistory } from 'vue-router'
import type { RecurrenceFrequency } from '@/db/schema'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { restoreScroll } from '@/app/scroll'
import { i18n } from '@/i18n'

/** Kinds of the quick add as written in the URL, with the title of the page. */
const NEW_KINDS: Record<string, { kind: 'expense' | 'income' | 'transfer', titleKey: string }> = {
  uscita: { kind: 'expense', titleKey: 'editor.newExpense' },
  entrata: { kind: 'income', titleKey: 'editor.newIncome' },
  trasferimento: { kind: 'transfer', titleKey: 'editor.newTransfer' },
}

/** `?ripeti=mensile`: the quick add opens with the repeat already chosen («Nuova ricorrenza»). */
const REPEAT_QUERY: Record<string, RecurrenceFrequency> = {
  giornaliero: 'daily',
  settimanale: 'weekly',
  mensile: 'monthly',
  annuale: 'yearly',
}

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
    meta: { titleKey: 'nav.transactions', quickAdd: true },
  },
  {
    path: '/budget',
    name: 'budget',
    component: () => import('@/features/budgets/BudgetView.vue'),
    meta: { titleKey: 'nav.budget', quickAdd: true },
  },
  {
    path: '/budget/:categoria',
    name: 'budget-edit',
    component: () => import('@/features/budgets/BudgetEditView.vue'),
    props: route => ({
      categoryKey: route.params.categoria,
      month: route.query.mese,
    }),
    meta: {
      titleKey: route => route.params.categoria === 'totale'
        ? 'budgetEdit.totalTitle'
        : 'budgetEdit.title',
      fullscreen: true,
      depth: 1,
    },
  },
  {
    path: '/statistiche',
    name: 'stats',
    component: () => import('@/features/stats/StatsView.vue'),
    meta: { titleKey: 'nav.stats', quickAdd: true },
  },
  {
    path: '/statistiche/categoria/:id',
    name: 'stats-category',
    component: () => import('@/features/stats/CategoryTrendView.vue'),
    props: route => ({
      categoryId: route.params.id,
      month: typeof route.query.mese === 'string'
        ? route.query.mese
        : undefined,
    }),
    meta: { titleKey: 'nav.stats', fullscreen: true, depth: 1 },
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
    meta: { titleKey: 'categories.title', fullscreen: true, depth: 1 },
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
      depth: 2,
    },
  },
  {
    path: '/impostazioni/conti',
    name: 'accounts',
    component: () => import('@/features/accounts/AccountsView.vue'),
    meta: { titleKey: 'accounts.title', fullscreen: true, depth: 1 },
  },
  {
    path: '/impostazioni/conti/:id',
    name: 'account-edit',
    component: () => import('@/features/accounts/AccountEditView.vue'),
    props: route => ({
      id: route.params.id === 'nuovo'
        ? null
        : route.params.id,
    }),
    meta: {
      titleKey: route => route.params.id === 'nuovo'
        ? 'accountEdit.new'
        : 'accountEdit.edit',
      fullscreen: true,
      depth: 2,
    },
  },
  {
    path: '/impostazioni/pagamenti',
    name: 'payment-methods',
    component: () => import('@/features/payments/PaymentMethodsView.vue'),
    meta: { titleKey: 'payments.title', fullscreen: true, depth: 1 },
  },
  {
    path: '/impostazioni/pagamenti/:id',
    name: 'payment-method-edit',
    component: () => import('@/features/payments/PaymentMethodEditView.vue'),
    props: route => ({
      id: route.params.id === 'nuovo'
        ? null
        : route.params.id,
    }),
    meta: {
      titleKey: route => route.params.id === 'nuovo'
        ? 'paymentEdit.new'
        : 'paymentEdit.edit',
      fullscreen: true,
      depth: 2,
    },
  },
  {
    path: '/impostazioni/importa',
    name: 'import',
    component: () => import('@/features/import/ImportView.vue'),
    meta: { titleKey: 'import.title', fullscreen: true, depth: 1 },
  },
  {
    path: '/impostazioni/regole',
    name: 'import-rules',
    component: () => import('@/features/import/ImportRulesView.vue'),
    meta: { titleKey: 'importRules.title', fullscreen: true, depth: 1 },
  },
  {
    path: '/nuovo/:kind(uscita|entrata|trasferimento)',
    name: 'transaction-new',
    component: () => import('@/features/transactions/TransactionEditorView.vue'),
    props: (route) => {
      const repeat = typeof route.query.ripeti === 'string'
        ? REPEAT_QUERY[route.query.ripeti]
        : undefined
      return {
        target: {
          mode: 'new',
          kind: NEW_KINDS[route.params.kind as string]?.kind ?? 'expense',
          ...(repeat
            ? { repeat }
            : {}),
        },
      }
    },
    meta: {
      titleKey: route => NEW_KINDS[route.params.kind as string]?.titleKey ?? 'editor.newExpense',
      fullscreen: true,
      modal: true,
    },
  },
  {
    path: '/movimenti/:id',
    name: 'transaction-edit',
    component: () => import('@/features/transactions/TransactionEditorView.vue'),
    props: route => ({
      target: { mode: 'edit', id: route.params.id },
    }),
    meta: { titleKey: 'editor.edit', fullscreen: true, modal: true },
  },
  {
    path: '/impostazioni/ricorrenze',
    name: 'recurrences',
    component: () => import('@/features/recurrences/RecurrencesView.vue'),
    meta: { titleKey: 'recurrences.title', fullscreen: true, depth: 1 },
  },
  {
    path: '/ricorrenze/:id',
    name: 'recurrence-edit',
    component: () => import('@/features/transactions/TransactionEditorView.vue'),
    props: route => ({
      target: { mode: 'rule', id: route.params.id },
    }),
    meta: { titleKey: 'editor.editRule', fullscreen: true, modal: true },
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
    // Back from the edit screen, the list returns where it was, once its rows are drawn.
    scrollBehavior: restoreScroll,
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
 * to the Home afterwards (docs/specs/released/onboarding.md). Installed by main.ts, not by
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
