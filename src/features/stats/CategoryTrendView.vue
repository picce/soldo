<script setup lang="ts">
import type { BarSeries } from '@/components/BarChart.vue'
import type { Category } from '@/db/schema'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import BarChart from '@/components/BarChart.vue'
import SubPage from '@/components/SubPage.vue'
import { categoryName } from '@/db/names'
import { getCategory } from '@/db/repositories/categories'
import { listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import { isMonth, monthOf, monthRange } from '@/domain/budgets'
import { formatDate, today } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import { categoryTrend, change } from '@/domain/stats'
import { useIntlLocale } from '@/i18n/locale'
import { useAccountFilterStore } from '@/stores/account-filter'
import StatsChange from './StatsChange.vue'

/**
 * One category over the 12 months that end with the chosen one (docs/specs/released/statistiche.md,
 * "Andamento di una categoria"): its total against the average, the bars with the average line,
 * every month in a list, and the way to its transactions.
 */
const props = defineProps<{
  categoryId: string
  month?: string
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()
const router = useRouter()
const { accountId } = storeToRefs(useAccountFilterStore())

const current = today()
const month = isMonth(props.month)
  ? props.month
  : monthOf(current)

const category = shallowRef<Category>()
void getCategory(props.categoryId).then((found) => {
  if (found)
    category.value = found
  else
    void router.replace({ name: 'stats' })
})

const { data: rows } = useLiveQuery(() => listTransactions({
  categoryIds: [props.categoryId],
  accountId: accountId.value ?? undefined,
}), [accountId])

const trend = computed(() => rows.value
  ? categoryTrend(rows.value, month, current)
  : undefined)
const total = computed(() => trend.value?.months.at(-1)?.cents ?? 0)
const yearTotal = computed(() => trend.value?.months.reduce((sum, { cents }) => sum + cents, 0) ?? 0)
const isRunning = computed(() => month === monthOf(current))
/** A month still running is not compared with whole months: it would always look cheaper. */
const versusAverage = computed(() => !isRunning.value && trend.value?.averageCents != null
  ? change(total.value, trend.value.averageCents)
  : undefined)

const name = computed(() => category.value
  ? categoryName(category.value)
  : '')
const color = computed(() => category.value
  ? `var(--color-category-${category.value.color})`
  : 'var(--color-ink-2)')

function amount(cents: number): string {
  return formatAmount(cents, intlLocale.value, { currency: true })
}

function bare(cents: number): string {
  return formatAmount(cents, intlLocale.value)
}

function tick(cents: number): string {
  return new Intl.NumberFormat(intlLocale.value, { maximumFractionDigits: 0 }).format(cents / 100)
}

function monthTitle(key: string): string {
  const label = formatDate(`${key}-01`, intlLocale.value, { month: 'long', year: 'numeric' })
  return label.charAt(0).toLocaleUpperCase(intlLocale.value) + label.slice(1)
}

const series = computed<BarSeries[]>(() => [
  {
    key: 'category',
    label: name.value,
    values: trend.value?.months.map(({ cents }) => cents) ?? [],
    color: color.value,
  },
])

const letters = computed(() => trend.value?.months.map(({ month: key }) =>
  formatDate(`${key}-01`, intlLocale.value, { month: 'narrow' })) ?? [])

const selected = ref<number | null>(null)
const readout = computed(() => {
  const chosen = selected.value === null
    ? undefined
    : trend.value?.months[selected.value]
  return chosen
    ? {
        title: monthTitle(chosen.month),
        amount: amount(chosen.cents),
      }
    : undefined
})

const recentFirst = computed(() => [
  ...(trend.value?.months ?? []),
].reverse())

const monthName = formatDate(`${month}-01`, intlLocale.value, { month: 'long' })
const transactionsLink = computed(() => ({
  name: 'transactions',
  query: { categoria: props.categoryId, dal: monthRange(month).from, al: monthRange(month).to },
}))
</script>

<template>
  <SubPage :title="name" :back="{ name: 'stats', query: { mese: month } }">
    <div v-if="trend" class="trend">
      <section class="trend-card" aria-labelledby="trend-month">
        <h2 id="trend-month" class="trend__muted type-label">
          {{ monthTitle(month) }}
        </h2>
        <p class="trend-card__total">
          {{ amount(total) }}
          <span v-if="isRunning" class="trend__muted type-small">{{ t('stats.trend.soFar') }}</span>
        </p>
        <StatsChange v-if="versusAverage" :change="versusAverage" :against="t('stats.trend.onAverage')" class="type-small" />
        <p v-else-if="trend.averageCents == null" class="trend__muted type-small">
          {{ t('stats.trend.noAverage') }}
        </p>
        <dl class="trend-card__figures">
          <div v-if="trend.averageCents != null">
            <dt class="trend__muted type-note">
              {{ t('stats.trend.average') }}
            </dt>
            <dd class="trend-card__figure">
              {{ bare(trend.averageCents) }}
            </dd>
          </div>
          <div>
            <dt class="trend__muted type-note">
              {{ t('stats.trend.total') }}
            </dt>
            <dd class="trend-card__figure">
              {{ bare(yearTotal) }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="trend-chart" aria-labelledby="trend-chart-title">
        <div class="trend-chart__head">
          <h2 id="trend-chart-title" class="trend__muted type-label">
            {{ t('stats.trend.months') }}
          </h2>
          <p class="type-small" aria-live="polite">
            <template v-if="readout">
              <b>{{ readout.title }}</b> {{ readout.amount }}
            </template>
          </p>
        </div>
        <BarChart
          v-model:selected="selected"
          :label="t('stats.trend.chart', { category: name })"
          :series="series"
          :labels="letters"
          :point-label="index => monthTitle(trend!.months[index]!.month)"
          :format-value="amount"
          :format-tick="tick"
          :average="trend.averageCents"
          :average-label="t('stats.trend.averageShort')"
          :emphasis="11"
        />
      </section>

      <ul class="trend-months" aria-hidden="true">
        <li v-for="item in recentFirst" :key="item.month" class="trend-months__row">
          <span class="type-body">{{ monthTitle(item.month) }}</span>
          <span class="trend-months__amount">{{ bare(item.cents) }}</span>
        </li>
      </ul>
    </div>

    <template #footer>
      <VvButton :to="transactionsLink" :label="t('stats.trend.transactions', { month: monthName })" modifiers="secondary" class="trend__transactions">
        <template #before>
          <AppIcon name="receipt" class="trend__transactions-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.trend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.trend__muted {
  color: var(--color-ink-2);
}

h2,
p,
dl,
dd {
  margin: 0;
}

.trend-card,
.trend-chart {
  padding: 0.875rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.trend-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.trend-card__total {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}

.trend-card__total .type-small {
  font-family: var(--font-sans);
  font-weight: 400;
  letter-spacing: 0;
}

.trend-card__figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.375rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--color-line);
}

.trend-card__figures > div {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.trend-card__figure,
.trend-months__amount {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.trend-chart__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.5rem;
  min-height: 1.5rem;
  margin-bottom: 0.375rem;
}

.trend-chart__head b {
  font-weight: 600;
}

.trend-months {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.trend-months__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
}

.trend-months__row + .trend-months__row {
  border-top: 1px solid var(--color-line);
}

.trend__transactions {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.trend__transactions-icon {
  --app-icon-size: 1.25rem;
}
</style>
