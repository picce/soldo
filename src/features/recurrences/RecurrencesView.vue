<script setup lang="ts">
import type { Account, Category, PaymentMethod, Recurrence } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import ArchivedSection from '@/components/ArchivedSection.vue'
import SubPage from '@/components/SubPage.vue'
import { accountName, paymentMethodName, transferRoute } from '@/db/names'
import { listAccounts } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import { listRecurrences } from '@/db/repositories/recurrences'
import { useLiveQuery } from '@/db/useLiveQuery'
import { addDays, formatDate, today } from '@/domain/dates'
import { signedCents } from '@/domain/days'
import { isFinished, nextOccurrence, nextOccurrences } from '@/domain/recurrences'
import { useIntlLocale } from '@/i18n/locale'
import { describeEvery, recurrenceName } from './describe'

/**
 * Series of transactions (docs/specs/ricorrenze.md, mockup "Ricorrenze"): what comes in the next
 * 30 days, the active series and, closed at the end, those that are over. A series opens on the
 * quick-add screen; «Nuova ricorrenza» opens the quick add with «Ogni mese» chosen.
 */
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 10

const { t } = useI18n()
const intlLocale = useIntlLocale()

const { data } = useLiveQuery(async () => {
  const [recurrences, categories, accounts, methods] = await Promise.all([
    listRecurrences(),
    listCategories({ includeArchived: true }),
    listAccounts({ includeArchived: true }),
    listPaymentMethods({ includeArchived: true }),
  ])
  return {
    recurrences,
    categories,
    accounts,
    methods,
  }
})

function byId<T extends { id: string }>(rows: T[] | undefined, id: string | null | undefined): T | undefined {
  return id
    ? rows?.find(row => row.id === id)
    : undefined
}

interface SeriesRow {
  recurrence: Recurrence
  name: string
  category?: Category
  /** «Ogni mese», then how it is paid or where the money goes. */
  every: string
  money: string
  cents: number
  isTransfer: boolean
}

/** How an expense is paid, the account of an income, or the two of a transfer. */
function moneyOf(recurrence: Recurrence, accounts: Account[], methods: PaymentMethod[]): string {
  const { template } = recurrence
  if (template.kind === 'transfer')
    return transferRoute(byId(accounts, template.accountId), byId(accounts, template.toAccountId))
  const method = byId(methods, template.paymentMethodId)
  if (method)
    return paymentMethodName(method)
  const account = byId(accounts, template.accountId)
  return account
    ? accountName(account)
    : ''
}

const rows = computed<SeriesRow[]>(() => {
  if (!data.value)
    return []
  const { recurrences, categories, accounts, methods } = data.value
  return recurrences.map((recurrence) => {
    const category = byId(categories, recurrence.template.categoryId)
    const isTransfer = recurrence.template.kind === 'transfer'
    return {
      recurrence,
      name: recurrenceName(recurrence.template, category),
      category,
      every: describeEvery(recurrence),
      money: moneyOf(recurrence, accounts, methods),
      cents: isTransfer
        ? recurrence.template.amountCents
        : signedCents(recurrence.template),
      isTransfer,
    }
  })
})

const current = today()

const active = computed(() => rows.value
  .filter(row => !isFinished(row.recurrence, current))
  .map(row => ({
    ...row,
    next: nextOccurrence(row.recurrence, current)!,
  }))
  .sort((a, b) => a.next.localeCompare(b.next) || a.name.localeCompare(b.name)))
const finished = computed(() => rows.value.filter(row => isFinished(row.recurrence, current)))

const upcoming = computed(() => active.value
  .flatMap(row => nextOccurrences(row.recurrence, current, addDays(current, UPCOMING_DAYS), UPCOMING_MAX)
    .map(date => ({ ...row, date })))
  .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  .slice(0, UPCOMING_MAX))

function shortDate(date: string): string {
  return formatDate(date, intlLocale.value, {
    day: 'numeric',
    month: 'short',
    ...(date.slice(0, 4) === current.slice(0, 4)
      ? {}
      : { year: 'numeric' }),
  })
}

function weekday(date: string): string {
  return formatDate(date, intlLocale.value, { weekday: 'short' })
}

function iconOf(row: SeriesRow): string {
  if (row.isTransfer)
    return 'arrows-left-right'
  return row.category?.icon ?? 'receipt'
}

function colorOf(row: SeriesRow): string | undefined {
  return row.category
    ? `var(--color-category-${row.category.color})`
    : undefined
}

const newSeries = {
  name: 'transaction-new',
  params: { kind: 'uscita' },
  query: { ripeti: 'mensile' },
}
</script>

<template>
  <SubPage :title="t('recurrences.title')" :back="{ name: 'settings' }">
    <template v-if="data">
      <div v-if="!rows.length" class="recurrences__empty">
        <AppIcon name="repeat" class="recurrences__empty-icon" />
        <p class="type-body-strong">
          {{ t('recurrences.emptyTitle') }}
        </p>
        <p class="recurrences__muted type-body">
          {{ t('recurrences.empty') }}
        </p>
      </div>

      <section v-if="upcoming.length" class="recurrences__section" aria-labelledby="recurrences-upcoming">
        <div class="recurrences__head">
          <h2 id="recurrences-upcoming" class="recurrences__label type-label">
            {{ t('recurrences.upcoming') }}
          </h2>
          <span class="recurrences__muted type-note">{{ t('recurrences.upcomingHint') }}</span>
        </div>
        <ul class="recurrences__card">
          <li v-for="row in upcoming" :key="`${row.recurrence.id}:${row.date}`" class="recurrences__upcoming">
            <span class="recurrences__day type-small">
              <span>{{ weekday(row.date) }}</span>
              <span>{{ shortDate(row.date) }}</span>
            </span>
            <span class="recurrences__text">
              <span class="recurrences__name type-body">{{ row.name }}</span>
              <span class="recurrences__muted type-small">{{ [row.every, row.money].filter(Boolean).join(' · ') }}</span>
            </span>
            <AmountText v-if="row.isTransfer" :cents="row.cents" />
            <AmountText v-else :cents="row.cents" :sign="row.cents > 0 ? 'always' : 'auto'" colored />
          </li>
        </ul>
      </section>

      <section v-if="active.length" class="recurrences__section" aria-labelledby="recurrences-active">
        <h2 id="recurrences-active" class="recurrences__label type-label">
          {{ t('recurrences.active') }}
        </h2>
        <ul class="recurrences__card">
          <li v-for="row in active" :key="row.recurrence.id">
            <RouterLink :to="{ name: 'recurrence-edit', params: { id: row.recurrence.id } }" class="recurrences__row">
              <AppIcon :name="iconOf(row)" class="recurrences__icon" :style="{ color: colorOf(row) }" />
              <span class="recurrences__text">
                <span class="recurrences__name type-body">{{ row.name }}</span>
                <span class="recurrences__muted type-small">
                  {{ row.every }} · {{ t(row.recurrence.startDate > current ? 'recurrences.starts' : 'recurrences.next', { date: shortDate(row.next) }) }}
                </span>
              </span>
              <AmountText v-if="row.isTransfer" :cents="row.cents" />
              <AmountText v-else :cents="row.cents" :sign="row.cents > 0 ? 'always' : 'auto'" colored />
              <AppIcon name="caret-right" class="recurrences__caret" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <ArchivedSection v-if="finished.length" :label="t('recurrences.finished', { count: finished.length })" class="recurrences__finished">
        <ul class="recurrences__card">
          <li v-for="row in finished" :key="row.recurrence.id">
            <RouterLink :to="{ name: 'recurrence-edit', params: { id: row.recurrence.id } }" class="recurrences__row">
              <AppIcon :name="iconOf(row)" class="recurrences__icon" :style="{ color: colorOf(row) }" />
              <span class="recurrences__text">
                <span class="recurrences__name type-body">{{ row.name }}</span>
                <span class="recurrences__muted type-small">
                  {{ row.every }}<template v-if="row.recurrence.endDate"> · {{ t('recurrences.ended', { date: shortDate(row.recurrence.endDate) }) }}</template>
                </span>
              </span>
              <AmountText v-if="row.isTransfer" :cents="row.cents" />
              <AmountText v-else :cents="row.cents" :sign="row.cents > 0 ? 'always' : 'auto'" colored />
              <AppIcon name="caret-right" class="recurrences__caret" />
            </RouterLink>
          </li>
        </ul>
      </ArchivedSection>
    </template>

    <template #footer>
      <VvButton :to="newSeries" :label="t('recurrences.new')" modifiers="secondary" class="recurrences__new">
        <template #before>
          <AppIcon name="plus" weight="regular" class="recurrences__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.recurrences__section + .recurrences__section,
.recurrences__finished {
  margin-top: 1.5rem;
}

.recurrences__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.recurrences__label {
  margin: 0 0 0.5rem;
}

.recurrences__muted {
  color: var(--color-ink-2);
}

.recurrences__card {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.recurrences__finished .recurrences__card {
  margin-top: 0.75rem;
}

.recurrences__card > li + li {
  border-top: 1px solid var(--color-line);
}

.recurrences__upcoming,
.recurrences__row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.75rem;
  padding: 0.5rem 0.875rem;
}

.recurrences__row {
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .recurrences__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.recurrences__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.recurrences__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .recurrences__row {
    transition: none;
  }
}

.recurrences__day {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 3.25rem;
  color: var(--color-ink-2);
}

.recurrences__icon {
  --app-icon-size: 1.5rem;

  flex-shrink: 0;
}

.recurrences__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.recurrences__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recurrences__caret {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.recurrences__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}

.recurrences__empty p {
  margin: 0;
}

.recurrences__empty-icon {
  --app-icon-size: 2.5rem;

  color: var(--color-ink-2);
}

.recurrences__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.recurrences__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
