<script setup lang="ts">
import type { Choice } from '@/components/ChoiceList.vue'
import type { Category } from '@/db/schema'
import type { Period } from '@/domain/periods'
import { computed, ref } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ActionBar from '@/components/ActionBar.vue'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppPage from '@/components/AppPage.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import BudgetMeter from '@/components/BudgetMeter.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import { categoryName } from '@/db/names'
import { listBudgets } from '@/db/repositories/budgets'
import { listCategories } from '@/db/repositories/categories'
import { listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import {
  budgetsInForce,
  dailyAllowance,
  daysLeft,
  isMonth,
  monthOf,
  monthRange,
  monthSpending,
  shiftMonth,
  spentFor,
} from '@/domain/budgets'
import { today } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'
import BudgetFlag from './BudgetFlag.vue'

/**
 * Budgets of a month (docs/specs/released/budget-mensili.md, mockup "Budget"): the total and each category
 * with spent, budget, bar and what is left. The month lives in the address (`?mese=2026-11`), so
 * Indietro from a budget comes back to it. Budgets count every account: no account selector here.
 */
const TOTAL = 'totale'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const intlLocale = useIntlLocale()

const month = computed(() => isMonth(route.query.mese)
  ? route.query.mese
  : monthOf(today()))
const period = computed<Period>(() => ({ unit: 'month', anchor: `${month.value}-01` }))
const direction = ref<-1 | 0 | 1>(0)

function shift(step: -1 | 1) {
  direction.value = step
  void router.replace({
    query: {
      ...route.query,
      mese: shiftMonth(month.value, step),
    },
  })
}

const { data } = useLiveQuery(async () => {
  const shown = month.value
  const [budgets, transactions, categories] = await Promise.all([
    listBudgets(),
    listTransactions(monthRange(shown)),
    listCategories({ kind: 'expense', includeArchived: true }),
  ])
  return {
    month: shown,
    budgets,
    categories,
    spending: monthSpending(transactions, shown),
  }
}, [month])

const inForce = computed(() => data.value
  ? budgetsInForce(data.value.budgets, data.value.month)
  : new Map())
const total = computed(() => inForce.value.get(null))
const spentTotal = computed(() => data.value?.spending.totalCents ?? 0)

interface BudgetRow {
  category: Category
  budgetCents: number
  spentCents: number
}

// In the order of the categories; a deleted category is not listed, an archived one is.
const rows = computed<BudgetRow[]>(() => (data.value?.categories ?? []).flatMap((category) => {
  const budget = inForce.value.get(category.id)
  return budget && data.value
    ? [
        {
          category,
          budgetCents: budget.amountCents,
          spentCents: spentFor(data.value.spending, category.id),
        },
      ]
    : []
}))
const unbudgetedCents = computed(() => spentTotal.value - rows.value.reduce((sum, row) => sum + row.spentCents, 0))
const isEmpty = computed(() => !!data.value && !total.value && !rows.value.length)

const remaining = computed(() => total.value
  ? total.value.amountCents - spentTotal.value
  : 0)
const daily = computed(() => dailyAllowance(remaining.value, month.value, today()))
const daysToGo = computed(() => daysLeft(month.value, today()))

function editRoute(key: string | null) {
  return {
    name: 'budget-edit',
    params: { categoria: key ?? TOTAL },
    query: { mese: month.value },
  }
}

function amount(cents: number) {
  return formatAmount(cents, intlLocale.value, { currency: true })
}

// «Aggiungi budget»: the total when it is missing, then the active categories without one.
const addOpen = ref(false)
const choices = computed<Choice[]>(() => [
  ...(total.value
    ? []
    : [
        {
          id: TOTAL,
          title: t('budgets.total'),
          icon: 'piggy-bank',
        },
      ]),
  ...(data.value?.categories ?? [])
    .filter(category => !category.archived && !inForce.value.has(category.id))
    .map(category => ({
      id: category.id,
      title: categoryName(category),
      icon: category.icon,
      color: category.color,
    })),
])

function openBudget(id: string) {
  addOpen.value = false
  void router.push(editRoute(id === TOTAL
    ? null
    : id))
}
</script>

<template>
  <AppPage :title="t('nav.budget')" class="budget" :class="{ 'budget--with-bar': !isEmpty && choices.length }">
    <PeriodSwitcher :period="period" :direction="direction" :show-tabs="false" @shift="shift" />

    <template v-if="data">
      <div v-if="isEmpty" class="budget__empty">
        <AppIcon name="piggy-bank" class="budget__empty-icon" />
        <p class="budget__empty-title type-body-strong">
          {{ t('budgets.emptyTitle') }}
        </p>
        <p class="budget__muted type-body">
          {{ t('budgets.emptyText') }}
        </p>
        <VvButton :label="t('budgets.emptyAction')" modifiers="primary" class="budget__empty-action" @click="addOpen = true">
          <template #before>
            <AppIcon name="plus" weight="regular" />
          </template>
        </VvButton>
      </div>

      <template v-else>
        <RouterLink
          v-if="total"
          :to="editRoute(null)"
          class="budget-card"
        >
          <span class="budget-card__head">
            <span class="type-label">{{ t('budgets.total') }}</span>
            <BudgetFlag :spent-cents="spentTotal" :budget-cents="total.amountCents" always class="type-note" />
          </span>
          <span class="budget-card__left">
            <AmountText :cents="Math.abs(remaining)" currency large />
            <span class="budget__muted type-small">{{ remaining < 0 ? t('budgets.over') : t('budgets.left') }}</span>
          </span>
          <BudgetMeter :spent-cents="spentTotal" :budget-cents="total.amountCents" :label="t('budgets.total')" />
          <span class="budget__muted type-note">{{ t('budgets.spentTotalOf', { spent: amount(spentTotal), budget: amount(total.amountCents) }) }}</span>
          <span v-if="daily !== undefined" class="budget-card__daily type-small">
            <AppIcon name="calendar-blank" class="budget-card__daily-icon" />
            <I18nT keypath="budgets.daily" :plural="daysToGo" tag="span">
              <template #days>
                {{ daysToGo }}
              </template>
              <template #amount>
                <strong class="budget-card__daily-amount">{{ amount(daily) }}</strong>
              </template>
            </I18nT>
          </span>
        </RouterLink>
        <div v-else class="budget-card budget-card--plain">
          <span class="budget-card__head">
            <span class="type-label">{{ t('budgets.spentMonth') }}</span>
          </span>
          <AmountText :cents="spentTotal" currency large />
          <RouterLink :to="editRoute(null)" class="budget-card__set">
            <AppIcon name="plus" weight="regular" />
            {{ t('budgets.setTotal') }}
          </RouterLink>
        </div>

        <section v-if="rows.length" class="budget__section" aria-labelledby="budget-categories-title">
          <h2 id="budget-categories-title" class="budget__label type-label">
            {{ t('budgets.byCategory') }}
          </h2>
          <ul class="budget-rows">
            <li v-for="row in rows" :key="row.category.id">
              <RouterLink :to="editRoute(row.category.id)" class="budget-row">
                <AppIcon
                  :name="row.category.icon"
                  class="budget-row__icon"
                  :style="{ color: `var(--color-category-${row.category.color})` }"
                />
                <span class="budget-row__text">
                  <span class="type-body">{{ categoryName(row.category) }}</span>
                  <span class="budget__muted type-small">
                    {{ t('budgets.spentOf', { spent: amount(row.spentCents), budget: amount(row.budgetCents) }) }}
                    <BudgetFlag :spent-cents="row.spentCents" :budget-cents="row.budgetCents" />
                  </span>
                </span>
                <span class="budget-row__left">
                  <AmountText :cents="Math.abs(row.budgetCents - row.spentCents)" />
                  <span class="budget__muted type-small">{{ row.spentCents > row.budgetCents ? t('budgets.over') : t('budgets.left') }}</span>
                </span>
                <BudgetMeter
                  class="budget-row__meter"
                  :spent-cents="row.spentCents"
                  :budget-cents="row.budgetCents"
                  :label="t('budgets.ofCategory', { name: categoryName(row.category) })"
                />
              </RouterLink>
            </li>
            <li v-if="unbudgetedCents > 0" class="budget-rows__rest">
              <span class="budget__muted type-small">{{ t('budgets.unbudgeted') }}</span>
              <AmountText :cents="unbudgetedCents" class="budget__muted" />
            </li>
          </ul>
        </section>
      </template>
    </template>

    <ActionBar v-if="!isEmpty && choices.length" :label="t('budgets.actions')">
      <VvButton :label="t('budgets.add')" modifiers="secondary" class="action-bar__button" @click="addOpen = true">
        <template #before>
          <AppIcon name="plus" weight="regular" class="action-bar__icon" />
        </template>
      </VvButton>
    </ActionBar>

    <BottomSheet v-model="addOpen" :title="t('budgets.add')">
      <ChoiceList :choices="choices" :aria-label="t('budgets.add')" @select="openBudget" />
    </BottomSheet>
  </AppPage>
</template>

<style scoped>
.budget--with-bar {
  padding-bottom: var(--action-bar-height);
}

.budget__muted {
  color: var(--color-ink-2);
}

.budget__label {
  margin: 0 0 0.5rem;
}

.budget__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 0.75rem;
  text-align: center;
}

.budget__empty p {
  margin: 0;
}

.budget__empty-icon {
  --app-icon-size: 3rem;

  color: var(--color-ink-2);
}

.budget__empty-title {
  font-size: 1.25rem;
}

.budget__empty-action {
  gap: 0.5rem;
  min-height: 3rem;
}

.budget-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

a.budget-card:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

@media (hover: hover) {
  a.budget-card:hover {
    background: var(--color-hover);
  }
}

.budget-card:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.budget-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.budget-card__left {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.budget-card__daily {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-line);
}

.budget-card__daily-amount {
  font-weight: 600;
}

.budget-card__daily-icon {
  --app-icon-size: 1rem;

  color: var(--color-ink-2);
}

.budget-card__set {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  min-height: 2.75rem;
  color: var(--color-pen);
  font-weight: 600;
  text-decoration: none;
}

.budget-card__set:active {
  color: var(--color-pen-pressed);
}

@media (hover: hover) {
  .budget-card__set:hover {
    color: var(--color-pen-hover);
  }
}

.budget-rows {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.budget-rows li + li {
  border-top: 1px solid var(--color-line);
}

.budget-row {
  display: grid;
  grid-template-columns: 1.375rem 1fr auto;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.6875rem 0.875rem;
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .budget-row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.budget-row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.budget-row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .budget-card,
  .budget-row {
    transition: none;
  }
}

.budget-row__icon {
  --app-icon-size: 1.375rem;
}

.budget-row__text,
.budget-row__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.budget-row__left {
  align-items: flex-end;
}

.budget-row__meter {
  grid-column: 2 / 4;
}

.budget-rows__rest {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
  padding: 0 0.875rem;
}
</style>
