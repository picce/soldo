<script setup lang="ts">
import type { CategoryRow } from './CategoryRows.vue'
import type { Category } from '@/db/schema'
import type { Period } from '@/domain/periods'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionChip from '@/components/ActionChip.vue'
import AppLogo from '@/components/AppLogo.vue'
import AppPage from '@/components/AppPage.vue'
import CategoryBar from '@/components/CategoryBar.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import { categoryName } from '@/db/names'
import { listCategories } from '@/db/repositories/categories'
import { listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import { groupCategoryShares } from '@/domain/category-share'
import { formatDate, today } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import { periodLabel, periodRange } from '@/domain/periods'
import { summarize } from '@/domain/summary'
import { useIntlLocale } from '@/i18n/locale'
import { usePeriodStore } from '@/stores/period'
import CategoryRows from './CategoryRows.vue'
import HomeActions from './HomeActions.vue'
import SummaryCard from './SummaryCard.vue'
import { useHorizontalSwipe } from './useHorizontalSwipe'

/**
 * Home (docs/specs/released/home-rendiconto.md): the chosen period, its statement, the expenses
 * per category and the buttons to add an expense or an income.
 */
const { t } = useI18n()
const intlLocale = useIntlLocale()
const store = usePeriodStore()
const { period, direction, isCurrent } = storeToRefs(store)

// The result carries its period, so the page never mixes the totals of two periods.
const { data } = useLiveQuery(async () => {
  const shown: Period = period.value
  return { period: shown, transactions: await listTransactions(periodRange(shown)) }
}, [period])

const { data: categories } = useLiveQuery(() => listCategories({ includeArchived: true }))

const categoriesById = computed(() => new Map<string, Category>(
  (categories.value ?? []).map(category => [category.id, category]),
))

const summary = computed(() => data.value
  ? summarize(data.value.transactions)
  : undefined)
const isEmpty = computed(() => data.value?.transactions.length === 0)

const shares = computed(() => groupCategoryShares(summary.value?.expenseByCategory ?? []))

function colorOf(key: string): string {
  const category = categoriesById.value.get(key)
  return category
    ? `var(--color-category-${category.color})`
    : 'var(--color-ink-2)'
}

function nameOf(key: string): string {
  if (key === 'other')
    return t('home.other')
  const category = categoriesById.value.get(key)
  return category
    ? categoryName(category)
    : ''
}

const segments = computed(() => shares.value.map(share => ({
  key: share.key,
  color: colorOf(share.key),
  share: share.share,
})))

const rows = computed<CategoryRow[]>(() => {
  const range = data.value
    ? periodRange(data.value.period)
    : undefined
  return shares.value.map(share => ({
    key: share.key,
    name: nameOf(share.key),
    color: colorOf(share.key),
    cents: share.cents,
    percent: share.percent,
    to: {
      name: 'transactions',
      query: {
        categoria: share.categoryIds.join(','),
        dal: range?.from,
        al: range?.to,
      },
    },
  }))
})

const barLabel = computed(() => {
  const list = rows.value.slice(0, 3).map(row => `${row.name} ${row.percent}%`).join(', ')
  return list
    ? t('home.barLabel', { list })
    : t('home.noExpenses')
})

/** «a novembre», «nel 2026», «il 5 novembre»: the period inside the empty-state sentence. */
const emptyMessage = computed(() => {
  const { unit, anchor } = period.value
  const sameYear = anchor.slice(0, 4) === today().slice(0, 4)
  const year = sameYear
    ? {}
    : { year: 'numeric' } as const
  const date = {
    day: () => formatDate(anchor, intlLocale.value, { day: 'numeric', month: 'long', ...year }),
    week: () => periodLabel(period.value, intlLocale.value),
    month: () => formatDate(anchor, intlLocale.value, { month: 'long', ...year }),
    year: () => anchor.slice(0, 4),
  }[unit]()
  return t(`home.empty.${unit}`, { date })
})

const expenseTotal = computed(() => formatAmount(summary.value?.expenseCents ?? 0, intlLocale.value, { currency: true }))

const swipeArea = useTemplateRef<HTMLElement>('swipeArea')
useHorizontalSwipe(swipeArea, step => store.shift(step))
</script>

<template>
  <AppPage class="home">
    <template #title>
      <AppLogo />
    </template>
    <template #actions>
      <ActionChip
        v-if="!isCurrent"
        icon="calendar-dot"
        :label="t('period.today')"
        :aria-label="t('period.backToToday')"
        @click="store.goToToday()"
      />
    </template>

    <PeriodSwitcher
      :period="period"
      :direction="direction"
      controls="home-period"
      @update:unit="store.setUnit"
      @shift="store.shift"
    />

    <div
      id="home-period"
      ref="swipeArea"
      class="home__period"
      role="tabpanel"
      :aria-labelledby="`period-tab-${period.unit}`"
    >
      <template v-if="summary">
        <SummaryCard
          :income-cents="summary.incomeCents"
          :expense-cents="summary.expenseCents"
          :balance-cents="summary.balanceCents"
        />

        <section class="home__categories" aria-labelledby="home-categories-title">
          <div class="home__categories-head">
            <h2 id="home-categories-title" class="home__categories-title type-label">
              {{ t('home.byCategory') }}
            </h2>
            <span class="type-note">{{ expenseTotal }}</span>
          </div>
          <CategoryBar :segments="segments" :label="barLabel" />
          <CategoryRows v-if="rows.length" :rows="rows" class="home__rows" />
          <div v-else-if="isEmpty" class="home__empty">
            <p class="type-body-strong">
              {{ emptyMessage }}
            </p>
            <p class="home__empty-hint type-small">
              {{ t('home.emptyHint') }}
            </p>
          </div>
          <p v-else class="home__no-expenses type-small">
            {{ t('home.noExpenses') }}
          </p>
        </section>
      </template>
    </div>

    <HomeActions />
  </AppPage>
</template>

<style scoped>
.home {
  padding-bottom: var(--action-bar-height);
}

.home__period {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  touch-action: pan-y;
}

.home__categories-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.home__categories-title {
  margin: 0;
}

.home__rows {
  margin-top: 1rem;
}

.home__empty {
  margin-top: 1.75rem;
}

.home__empty p {
  margin: 0;
}

.home__empty-hint {
  margin: 0.25rem 0 0;
  color: var(--color-ink-2);
}

.home__no-expenses {
  margin: 1rem 0 0;
  color: var(--color-ink-2);
}
</style>
