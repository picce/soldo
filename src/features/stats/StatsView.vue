<script setup lang="ts">
import type { BarSeries } from '@/components/BarChart.vue'
import type { LineSeries } from '@/components/LineChart.vue'
import type { Category } from '@/db/schema'
import type { PeriodUnit } from '@/domain/periods'
import type { CategoryChange, StatsPeriod, StatsUnit } from '@/domain/stats'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AppPage from '@/components/AppPage.vue'
import BarChart from '@/components/BarChart.vue'
import LineChart from '@/components/LineChart.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import { categoryName } from '@/db/names'
import { listCategories } from '@/db/repositories/categories'
import { hasTransactions, listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import { isMonth, monthOf, shiftMonth } from '@/domain/budgets'
import { formatDate, today } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import {
  average,
  categoryChanges,
  change,
  countedRange,
  cumulativeByDay,
  daysIn,
  isCurrentPeriod,
  isYear,
  monthByMonth,
  monthsIn,
  previousRange,
  shiftStatsPeriod,
  statsPeriodOf,
  statsRange,
  totals,
} from '@/domain/stats'
import AccountSelector from '@/features/accounts/AccountSelector.vue'
import { useIntlLocale } from '@/i18n/locale'
import { useAccountFilterStore } from '@/stores/account-filter'
import StatsChange from './StatsChange.vue'

/**
 * Statistics (docs/specs/released/statistiche.md): a month day by day or a year month by month, each
 * figure next to the period before at the same point, and the categories that changed. The
 * period lives in the address (`?mese=2026-11`, `?anno=2026`), so «Indietro» from a category
 * comes back to it.
 */
const { t } = useI18n()
const intlLocale = useIntlLocale()
const route = useRoute()
const router = useRouter()
const { accountId } = storeToRefs(useAccountFilterStore())

const current = today()

const period = computed<StatsPeriod>(() => {
  const { mese, anno } = route.query
  if (isYear(anno))
    return { unit: 'year', key: anno }
  return isMonth(mese)
    ? { unit: 'month', key: mese }
    : statsPeriodOf('month', current)
})

const direction = ref<-1 | 0 | 1>(0)

function show(next: StatsPeriod) {
  void router.replace({
    query: next.unit === 'month'
      ? { mese: next.key }
      : { anno: next.key },
  })
}

function shift(step: -1 | 1) {
  direction.value = step
  show(shiftStatsPeriod(period.value, step))
}

/** From a year to its month of today, or to December of a year gone; from a month to its year. */
function setUnit(unit: PeriodUnit) {
  direction.value = 0
  const { key } = period.value
  if (unit === 'year') {
    show({
      unit: 'year',
      key: key.slice(0, 4),
    })
  }
  else {
    show({
      unit: 'month',
      key: current.startsWith(key)
        ? monthOf(current)
        : `${key}-12`,
    })
  }
}

const switcherPeriod = computed(() => ({ unit: period.value.unit, anchor: statsRange(period.value).from }))

const counted = computed(() => countedRange(period.value, current))
const previous = computed(() => previousRange(period.value, current))
const isCurrent = computed(() => isCurrentPeriod(period.value, current))
/** A period still to come has nothing to show, not even zeros on a line. */
const isFuture = computed(() => statsRange(period.value).from > current)

// The result carries its period, so the page never mixes the figures of two periods.
const { data } = useLiveQuery(async () => {
  const shown = period.value
  return {
    period: shown,
    rows: await listTransactions({
      from: previousRange(shown, current).from,
      to: statsRange(shown).to,
      accountId: accountId.value ?? undefined,
    }),
  }
}, [period, accountId])

const { data: anyTransaction } = useLiveQuery(() => hasTransactions())
const { data: categories } = useLiveQuery(() => listCategories({ includeArchived: true }))

const categoriesById = computed(() => new Map<string, Category>((categories.value ?? []).map(category => [category.id, category])))

const rows = computed(() => data.value?.period === period.value
  ? data.value.rows
  : undefined)

function amount(cents: number, options: { sign?: 'always' } = {}): string {
  return formatAmount(cents, intlLocale.value, { currency: true, ...options })
}

function bare(cents: number): string {
  return formatAmount(cents, intlLocale.value)
}

/** Values of the axis: whole euros, «1.000». */
function tick(cents: number): string {
  return new Intl.NumberFormat(intlLocale.value, { maximumFractionDigits: 0 }).format(cents / 100)
}

const now = computed(() => rows.value
  ? totals(rows.value, counted.value)
  : undefined)
const before = computed(() => rows.value
  ? totals(rows.value, previous.value)
  : undefined)
const expenseChange = computed(() => now.value && before.value
  ? change(now.value.expenseCents, before.value.expenseCents)
  : undefined)
const perUnit = computed(() => now.value
  ? average(now.value.expenseCents, period.value.unit === 'month'
      ? daysIn(counted.value)
      : monthsIn(counted.value))
  : 0)

function sameYear(date: string): boolean {
  return date.slice(0, 4) === current.slice(0, 4)
}

/** «1–7 ottobre», «ottobre», «2025, fino al 7 nov»: what the figures are compared with. */
const against = computed(() => {
  const { from, to } = previous.value
  if (period.value.unit === 'month') {
    const month = formatDate(from, intlLocale.value, {
      month: 'long',
      ...(sameYear(from)
        ? {}
        : { year: 'numeric' }),
    })
    return isCurrent.value
      ? t('stats.against.monthSoFar', { range: `${Number(from.slice(8, 10))}–${Number(to.slice(8, 10))} ${month}` })
      : t('stats.against.month', { month })
  }
  const year = from.slice(0, 4)
  return isCurrent.value
    ? t('stats.against.yearSoFar', {
        year,
        date: formatDate(to, intlLocale.value, { day: 'numeric', month: 'short' }),
      })
    : t('stats.against.year', { year })
})

/** Above the categories, the year alone: the card above already says up to which day. */
const againstShort = computed(() => period.value.unit === 'year'
  ? t('stats.against.year', {
      year: previous.value.from.slice(0, 4),
    })
  : against.value)

// Month: expenses added up day by day, this month and the one before.

const monthKey = computed(() => period.value.key)
const previousMonthKey = computed(() => shiftMonth(monthKey.value, -1))
const daysInMonth = computed(() => daysIn(statsRange({ unit: 'month', key: monthKey.value })))

const lines = computed<LineSeries[]>(() => {
  if (!rows.value || period.value.unit !== 'month')
    return []
  const name = (month: string) => formatDate(`${month}-01`, intlLocale.value, { month: 'long' })
  return [
    {
      key: 'now',
      label: name(monthKey.value),
      values: isFuture.value
        ? []
        : cumulativeByDay(rows.value, monthKey.value, current),
      color: 'var(--color-chart-expense)',
    },
    {
      key: 'before',
      label: name(previousMonthKey.value),
      values: cumulativeByDay(rows.value, previousMonthKey.value).slice(0, daysInMonth.value),
      color: 'var(--color-ink-2)',
      dashed: true,
    },
  ]
})

const dayTicks = computed(() => [0, 7, 14, 21, daysInMonth.value - 1])
const selectedDay = ref<number | null>(null)

function dayDate(index: number, month = monthKey.value): string {
  return `${month}-${String(index + 1).padStart(2, '0')}`
}

function dayName(index: number): string {
  return formatDate(dayDate(index), intlLocale.value, { day: 'numeric', month: 'long' })
}

const dayReadout = computed(() => {
  const index = selectedDay.value
  if (index === null)
    return undefined
  const [now, before] = lines.value
  return {
    title: formatDate(dayDate(index), intlLocale.value, { day: 'numeric', month: 'short' }),
    now: now?.values[index] === undefined
      ? undefined
      : amount(now.values[index]!),
    before: before?.values[index] === undefined
      ? undefined
      : `${formatDate(`${previousMonthKey.value}-01`, intlLocale.value, { month: 'short' })} ${amount(before.values[index]!)}`,
  }
})

// Year: income and expenses month by month.

const months = computed(() => rows.value && period.value.unit === 'year'
  ? monthByMonth(rows.value, period.value.key)
  : [])

const bars = computed<BarSeries[]>(() => [
  {
    key: 'income',
    label: t('stats.income'),
    values: months.value.map(month => month.incomeCents),
    color: 'var(--color-chart-income)',
  },
  {
    key: 'expense',
    label: t('stats.expenses'),
    values: months.value.map(month => month.expenseCents),
    color: 'var(--color-chart-expense)',
  },
])

const monthLetters = computed(() => months.value.map(({ month }) =>
  formatDate(`${month}-01`, intlLocale.value, { month: 'narrow' })))
const selectedMonth = ref<number | null>(null)

function monthName(index: number): string {
  return formatDate(`${months.value[index]!.month}-01`, intlLocale.value, { month: 'long', year: 'numeric' })
}

const monthReadout = computed(() => {
  const index = selectedMonth.value
  const month = index === null
    ? undefined
    : months.value[index]
  if (!month)
    return undefined
  const name = formatDate(`${month.month}-01`, intlLocale.value, { month: 'long' })
  return {
    key: month.month,
    name,
    title: name.charAt(0).toLocaleUpperCase(intlLocale.value) + name.slice(1),
    income: formatAmount(month.incomeCents, intlLocale.value, { sign: 'always' }),
    expense: formatAmount(-month.expenseCents, intlLocale.value),
  }
})

// Categories, with the period before.

interface CategoryRow extends CategoryChange {
  category: Category
}

function categoryRows(kind: 'expense' | 'income'): CategoryRow[] {
  if (!rows.value)
    return []
  return categoryChanges(rows.value, kind, counted.value, previous.value).flatMap((item) => {
    const category = categoriesById.value.get(item.categoryId)
    return category
      ? [
          { ...item, category },
        ]
      : []
  })
}

const expenseCategories = computed(() => categoryRows('expense'))
const incomeCategories = computed(() => categoryRows('income'))

/** The month a category opens on: this month, the month of today in this year, or December. */
const trendMonth = computed(() => {
  if (period.value.unit === 'month')
    return period.value.key
  return isCurrent.value
    ? monthOf(current)
    : `${period.value.key}-12`
})

/** Until it is known whether anything exists, the page shows neither the empty state nor zeros. */
const nothingYet = computed(() => anyTransaction.value === false)
const noExpenses = computed(() => now.value?.expenseCents === 0 && !isFuture.value)
const noExpensesText = computed(() => period.value.unit === 'month'
  ? t('stats.noExpensesMonth', {
      month: formatDate(`${monthKey.value}-01`, intlLocale.value, { month: 'long' }),
    })
  : t('stats.noExpensesYear', { year: period.value.key }))

const unitLabel = computed<StatsUnit>(() => period.value.unit)
</script>

<template>
  <AppPage :title="t('nav.stats')" class="stats">
    <template #actions>
      <AccountSelector />
    </template>

    <PeriodSwitcher
      :period="switcherPeriod"
      :direction="direction"
      :units="['month', 'year']"
      controls="stats-period"
      @update:unit="setUnit"
      @shift="shift"
    />

    <div id="stats-period" class="stats__period" role="tabpanel" :aria-labelledby="`period-tab-${unitLabel}`">
      <div v-if="nothingYet" class="stats__empty">
        <AppIcon name="chart-line" class="stats__empty-icon" />
        <p class="type-body-strong">
          {{ t('stats.empty.title') }}
        </p>
        <p class="stats__muted type-body">
          {{ t('stats.empty.text') }}
        </p>
        <VvButton :to="{ name: 'transaction-new', params: { kind: 'uscita' } }" :label="t('stats.empty.action')" modifiers="primary" class="stats__empty-action">
          <template #before>
            <AppIcon name="plus" weight="regular" />
          </template>
        </VvButton>
      </div>

      <template v-else-if="anyTransaction && now && expenseChange">
        <section class="stats-card" aria-labelledby="stats-expenses">
          <h2 id="stats-expenses" class="stats__muted type-label">
            {{ t('stats.expenses') }}
          </h2>
          <p class="stats-card__total">
            {{ amount(now.expenseCents) }}
          </p>
          <StatsChange :change="expenseChange" :against="against" class="type-small" />
          <dl class="stats-card__figures">
            <div>
              <dt class="stats__muted type-note">
                {{ t('stats.income') }}
              </dt>
              <dd class="stats-card__figure stats-card__figure--income">
                {{ bare(now.incomeCents) }}
              </dd>
            </div>
            <div>
              <dt class="stats__muted type-note">
                {{ t('stats.saved') }}
              </dt>
              <dd class="stats-card__figure">
                {{ bare(now.incomeCents - now.expenseCents) }}
              </dd>
            </div>
            <div>
              <dt class="stats__muted type-note">
                {{ period.unit === 'month' ? t('stats.perDay') : t('stats.perMonth') }}
              </dt>
              <dd class="stats-card__figure">
                {{ bare(perUnit) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="stats-chart" aria-labelledby="stats-chart-title">
          <div class="stats-chart__head">
            <h2 id="stats-chart-title" class="stats__muted type-label">
              {{ period.unit === 'month' ? t('stats.daily') : t('stats.monthly') }}
            </h2>
            <p class="stats-chart__readout type-small" aria-live="polite">
              <template v-if="period.unit === 'month' && dayReadout">
                <b>{{ dayReadout.title }}</b>
                <span v-if="dayReadout.now">{{ dayReadout.now }}</span>
                <span v-if="dayReadout.before" class="stats__muted">· {{ dayReadout.before }}</span>
              </template>
              <template v-else-if="period.unit === 'year' && monthReadout">
                <b>{{ monthReadout.title }}</b>
                <span class="stats__income">{{ monthReadout.income }}</span>
                <span>· {{ monthReadout.expense }}</span>
              </template>
            </p>
          </div>

          <LineChart
            v-if="period.unit === 'month'"
            v-model:selected="selectedDay"
            :label="t('stats.dailyChart')"
            :series="lines"
            :length="daysInMonth"
            :ticks="dayTicks"
            :tick-label="index => String(index + 1)"
            :point-label="dayName"
            :format-value="amount"
            :format-tick="tick"
            :marker="isCurrent ? Number(current.slice(8, 10)) - 1 : undefined"
          />
          <BarChart
            v-else
            v-model:selected="selectedMonth"
            :label="t('stats.monthlyChart')"
            :series="bars"
            :labels="monthLetters"
            :point-label="monthName"
            :format-value="amount"
            :format-tick="tick"
          />

          <p v-if="noExpenses" class="stats__muted type-small stats-chart__none">
            {{ noExpensesText }}
          </p>

          <div class="stats-chart__foot">
            <span class="stats-legend type-note">
              <span v-for="item in (period.unit === 'month' ? lines : bars)" :key="item.key" class="stats-legend__item">
                <i
                  class="stats-legend__key"
                  :class="{
                    'stats-legend__key--dashed': 'dashed' in item && item.dashed,
                    'stats-legend__key--bar': period.unit === 'year',
                  }"
                  :style="{ '--key-color': item.color }"
                />
                {{ item.label }}
              </span>
            </span>
            <RouterLink
              v-if="period.unit === 'year' && monthReadout"
              :to="{ query: { mese: monthReadout.key } }"
              replace
              class="stats__link type-small"
            >
              {{ t('stats.open', { month: monthReadout.name }) }}
              <AppIcon name="caret-right" weight="regular" class="stats__link-icon" />
            </RouterLink>
          </div>
        </section>

        <section
          v-for="group in ([['expense', expenseCategories], ['income', incomeCategories]] as const)"
          v-show="group[1].length"
          :key="group[0]"
          class="stats-categories"
          :aria-labelledby="`stats-categories-${group[0]}`"
        >
          <div class="stats-categories__head">
            <h2 :id="`stats-categories-${group[0]}`" class="type-label">
              {{ t(`stats.byCategory.${group[0]}`) }}
            </h2>
            <span class="stats__muted type-note">{{ againstShort }}</span>
          </div>
          <ul class="stats-categories__list">
            <li v-for="item in group[1]" :key="item.categoryId">
              <RouterLink :to="{ name: 'stats-category', params: { id: item.categoryId }, query: { mese: trendMonth } }" class="stats-categories__row">
                <AppIcon :name="item.category.icon" class="stats-categories__icon" :style="{ color: `var(--color-category-${item.category.color})` }" />
                <span class="stats-categories__text">
                  <span class="type-body">{{ categoryName(item.category) }}</span>
                  <StatsChange :change="item" :new-word="t('stats.new')" class="stats__muted type-small" />
                </span>
                <span class="stats-categories__amount">{{ bare(item.cents) }}</span>
                <AppIcon name="caret-right" class="stats-categories__caret" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </AppPage>
</template>

<style scoped>
.stats__period {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stats__muted {
  color: var(--color-ink-2);
}

.stats__income {
  color: var(--color-income);
}

h2,
p,
dl,
dd {
  margin: 0;
}

.stats-card,
.stats-chart {
  padding: 0.875rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.stats-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.stats-card__total {
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}

.stats-card__figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.375rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--color-line);
}

.stats-card__figures > div {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.stats-card__figure {
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-card__figure--income {
  color: var(--color-income);
}

.stats-chart__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.5rem;
  min-height: 1.5rem;
  margin-bottom: 0.375rem;
}

/* The pieces of the readout, a space apart: «5 nov 198,60 € · ott 150,60 €». */
.stats-chart__readout {
  display: inline-flex;
  flex-wrap: wrap;
  column-gap: 0.3em;
}

.stats-chart__readout b {
  font-weight: 600;
}

.stats-chart__none {
  margin-top: 0.25rem;
}

.stats-chart__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2.75rem;
  margin-bottom: -0.5rem;
}

.stats-legend {
  display: flex;
  gap: 0.875rem;
  color: var(--color-ink-2);
}

.stats-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.stats-legend__key {
  width: 0.875rem;
  height: 3px;
  border-radius: 2px;
  background: var(--key-color);
}

.stats-legend__key--dashed {
  height: 0;
  border-top: 2px dashed var(--key-color);
  background: none;
}

.stats-legend__key--bar {
  width: 0.625rem;
  height: 0.625rem;
}

.stats__link {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  min-height: 2.75rem;
  color: var(--color-pen);
  font-weight: 600;
  text-decoration: none;
  transition: color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .stats__link:hover {
    color: var(--color-pen-hover);
  }
}

.stats__link:active {
  color: var(--color-pen-pressed);
  transition-duration: 0s;
}

.stats__link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: var(--rounded);
}

.stats__link-icon {
  --app-icon-size: 0.75rem;
}

.stats-categories__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.75rem 0 0.5rem;
}

.stats-categories__list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.stats-categories__list > li + li {
  border-top: 1px solid var(--color-line);
}

.stats-categories__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.5rem;
  padding: 0.5rem 0.875rem;
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .stats-categories__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.stats-categories__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.stats-categories__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .stats__link,
  .stats-categories__row {
    transition: none;
  }
}

.stats-categories__icon {
  --app-icon-size: 1.375rem;

  flex-shrink: 0;
}

.stats-categories__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.stats-categories__amount {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stats-categories__caret {
  --app-icon-size: 1rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.stats__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 0.75rem;
  text-align: center;
}

.stats__empty-icon {
  --app-icon-size: 2.5rem;

  color: var(--color-ink-2);
}

.stats__empty-action {
  min-height: 3.25rem;
  padding-inline: 1.5rem;
  gap: 0.5rem;
  text-decoration: none;
}
</style>
