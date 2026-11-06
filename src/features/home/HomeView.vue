<script setup lang="ts">
import type { CategoryRow } from './CategoryRows.vue'
import type { Category } from '@/db/schema'
import type { Period } from '@/domain/periods'
import type { CategoryTotal } from '@/domain/summary'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionChip from '@/components/ActionChip.vue'
import AppLogo from '@/components/AppLogo.vue'
import AppPage from '@/components/AppPage.vue'
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
import AccountSelector from '@/features/accounts/AccountSelector.vue'
import { useIntlLocale } from '@/i18n/locale'
import { useAccountFilterStore } from '@/stores/account-filter'
import { usePeriodStore } from '@/stores/period'
import CategorySection from './CategorySection.vue'
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
const { accountId } = storeToRefs(useAccountFilterStore())

// The result carries its period, so the page never mixes the totals of two periods.
const { data } = useLiveQuery(async () => {
  const shown: Period = period.value
  return {
    period: shown,
    transactions: await listTransactions({
      ...periodRange(shown),
      accountId: accountId.value ?? undefined,
    }),
  }
}, [period, accountId])

const { data: categories } = useLiveQuery(() => listCategories({ includeArchived: true }))

const categoriesById = computed(() => new Map<string, Category>(
  (categories.value ?? []).map(category => [category.id, category]),
))

const summary = computed(() => data.value
  ? summarize(data.value.transactions)
  : undefined)
const isEmpty = computed(() => data.value?.transactions.length === 0)

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

/**
 * Bar and rows of one kind: the first seven categories and «Altre», each row opening
 * Movimenti on that category and period. `labelKey` names the bar for screen readers.
 */
function breakdown(totals: CategoryTotal[], labelKey: 'home.barLabel' | 'home.incomeBarLabel', emptyLabel: string) {
  const range = data.value
    ? periodRange(data.value.period)
    : undefined
  const shares = groupCategoryShares(totals)
  const rows: CategoryRow[] = shares.map(share => ({
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
  const list = rows.slice(0, 3).map(row => `${row.name} ${row.percent}%`).join(', ')
  return {
    rows,
    segments: shares.map(share => ({
      key: share.key,
      color: colorOf(share.key),
      share: share.share,
    })),
    barLabel: list
      ? t(labelKey, { list })
      : emptyLabel,
  }
}

const expenses = computed(() => breakdown(summary.value?.expenseByCategory ?? [], 'home.barLabel', t('home.noExpenses')))
// The income section shows only when the period has income.
const income = computed(() => breakdown(summary.value?.incomeByCategory ?? [], 'home.incomeBarLabel', ''))

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
const incomeTotal = computed(() => formatAmount(summary.value?.incomeCents ?? 0, intlLocale.value, { currency: true }))

const swipeArea = useTemplateRef<HTMLElement>('swipeArea')
useHorizontalSwipe(swipeArea, step => store.shift(step))
</script>

<template>
  <AppPage class="home">
    <template #title>
      <AppLogo />
    </template>
    <template #actions>
      <div class="home__actions">
        <ActionChip
          v-if="!isCurrent"
          icon="calendar-dot"
          class="home__today"
          :label="t('period.today')"
          :aria-label="t('period.backToToday')"
          @click="store.goToToday()"
        />
        <AccountSelector />
      </div>
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

        <CategorySection
          title-id="home-categories-title"
          :title="t('home.byCategory')"
          :total="expenseTotal"
          :segments="expenses.segments"
          :bar-label="expenses.barLabel"
          :rows="expenses.rows"
        >
          <div v-if="isEmpty" class="home__empty">
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
        </CategorySection>

        <CategorySection
          v-if="income.rows.length"
          title-id="home-income-title"
          :title="t('home.incomeByCategory')"
          :total="incomeTotal"
          :segments="income.segments"
          :bar-label="income.barLabel"
          :rows="income.rows"
        />
      </template>
    </div>

    <HomeActions />
  </AppPage>
</template>

<style scoped>
.home {
  padding-bottom: var(--action-bar-height);
}

.home__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.home__today {
  flex-shrink: 0;
}

.home__period {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  touch-action: pan-y;
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
