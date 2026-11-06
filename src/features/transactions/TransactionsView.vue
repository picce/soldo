<script setup lang="ts">
import type { FilterItem } from './FilterSheet.vue'
import type { SwipeAction } from '@/components/SwipeRow.vue'
import type { Account, Category, PaymentMethod, Transaction } from '@/db/schema'
import type { DateRange, PeriodUnit } from '@/domain/periods'
import { useIntersectionObserver, watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import AppPage from '@/components/AppPage.vue'
import FilterChip from '@/components/FilterChip.vue'
import { collapse, expand } from '@/components/list-motion'
import SearchField from '@/components/SearchField.vue'
import SwipeRow from '@/components/SwipeRow.vue'
import { accountName, categoryName, paymentMethodName, transferRoute } from '@/db/names'
import { listAccounts } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import { deleteTransaction, duplicateTransaction, listTransactions } from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import { formatDate, today } from '@/domain/dates'
import { groupByDay } from '@/domain/days'
import { periodLabel, periodRange } from '@/domain/periods'
import { matchesSearch } from '@/domain/search'
import AccountSelector from '@/features/accounts/AccountSelector.vue'
import { useIntlLocale } from '@/i18n/locale'
import { useAccountFilterStore } from '@/stores/account-filter'
import DayGroup from './DayGroup.vue'
import FilterSheet from './FilterSheet.vue'
import { showDeleted, showDuplicated } from './notices'
import TransactionRow from './TransactionRow.vue'
import { useTransactionFilters } from './useTransactionFilters'

/**
 * Movimenti (docs/specs/released/movimenti.md): transactions grouped by day, search and filters in
 * the URL. A row opens the edit screen; swiped left it is deleted, swiped right duplicated
 * with today's date, each with «Annulla». Rows and days that come and go open and close in
 * height; a search or a filter redraws the list at once instead.
 */
const { t } = useI18n()
const intlLocale = useIntlLocale()
const filters = useTransactionFilters()
const { accountId } = storeToRefs(useAccountFilterStore())

/** Days drawn at first; scrolling to the end adds as many again. */
const DAYS_PER_PAGE = 30

// The field updates the URL a moment after typing stops; the URL drives the list.
const searchText = ref(filters.search.value)
watchDebounced(searchText, value => filters.setSearch(value), { debounce: 200 })
watch(filters.search, (value) => {
  if (value !== searchText.value.trim())
    searchText.value = value
})

const { data: transactions } = useLiveQuery(
  () => listTransactions({
    from: filters.range.value?.from,
    to: filters.range.value?.to,
    kinds: filters.kind.value
      ? [filters.kind.value]
      : undefined,
    accountId: accountId.value ?? undefined,
  }),
  [filters.range, filters.kind, accountId],
)
const { data: categories } = useLiveQuery(() => listCategories({ includeArchived: true }))
// Archived too: their transactions keep showing the name.
const { data: accounts } = useLiveQuery(() => listAccounts({ includeArchived: true }))
const { data: paymentMethods } = useLiveQuery(() => listPaymentMethods({ includeArchived: true }))

const categoriesById = computed(() => new Map<string, Category>((categories.value ?? []).map(item => [item.id, item])))
const accountsById = computed(() => new Map<string, Account>((accounts.value ?? []).map(item => [item.id, item])))
const paymentMethodsById = computed(() => new Map<string, PaymentMethod>((paymentMethods.value ?? []).map(item => [item.id, item])))

function categoryOf(transaction: Transaction) {
  return transaction.categoryId
    ? categoriesById.value.get(transaction.categoryId)
    : undefined
}

function routeOf(transaction: Transaction) {
  return transferRoute(accountsById.value.get(transaction.accountId), accountsById.value.get(transaction.toAccountId ?? ''))
}

function accountOf(transaction: Transaction) {
  if (transaction.kind === 'transfer')
    return routeOf(transaction)
  const account = accountsById.value.get(transaction.accountId)
  return account
    ? accountName(account)
    : ''
}

function paymentOf(transaction: Transaction) {
  const method = transaction.paymentMethodId
    ? paymentMethodsById.value.get(transaction.paymentMethodId)
    : undefined
  return method
    ? paymentMethodName(method)
    : ''
}

/** What a notice says the transaction is about: its category, or the accounts of a transfer. */
function subjectOf(transaction: Transaction) {
  return transaction.kind === 'transfer'
    ? routeOf(transaction)
    : categoryOf(transaction)
}

const visible = computed(() => {
  const ids = filters.categoryIds.value
  const payments = filters.paymentIds.value
  return (transactions.value ?? []).filter((transaction) => {
    if (ids.length && !(transaction.categoryId && ids.includes(transaction.categoryId)))
      return false
    if (payments.length && !(transaction.paymentMethodId && payments.includes(transaction.paymentMethodId)))
      return false
    const category = categoryOf(transaction)
    return matchesSearch(filters.search.value, [
      transaction.note,
      category
        ? categoryName(category)
        : '',
      paymentOf(transaction),
      // Only for transfers: with «Contanti» as the default account, searching it would find all.
      transaction.kind === 'transfer'
        ? `${t('transactions.transfer')} ${routeOf(transaction)}`
        : '',
    ])
  })
})

const days = computed(() => groupByDay(visible.value))
const dayLimit = ref(DAYS_PER_PAGE)
const shownDays = computed(() => days.value.slice(0, dayLimit.value))

watch([
  filters.search,
  filters.kind,
  filters.categoryIds,
  filters.paymentIds,
  filters.range,
  accountId,
], () => {
  dayLimit.value = DAYS_PER_PAGE
})

// The days added by scrolling just appear: opening thirty of them would be wasted work.
let growing = false
const sentinel = useTemplateRef<HTMLElement>('sentinel')
useIntersectionObserver(sentinel, async ([entry]) => {
  if (entry?.isIntersecting && dayLimit.value < days.value.length) {
    growing = true
    dayLimit.value += DAYS_PER_PAGE
    await nextTick()
    growing = false
  }
}, { rootMargin: '400px' })

function onDayEnter(element: Element, done: () => void) {
  if (growing)
    done()
  else
    expand(element, done)
}

/** A new key for every set of filters: the list is drawn again rather than animated. */
const listKey = computed(() => JSON.stringify([
  filters.search.value,
  filters.kind.value,
  filters.categoryIds.value,
  filters.paymentIds.value,
  filters.range.value,
  accountId.value,
]))

// Category filter: only the categories of the chosen kind; archived ones only if picked.
const filterOpen = ref(false)
const filterCategories = computed<FilterItem[]>(() => {
  const kind = filters.kind.value
  const picked = filters.categoryIds.value
  return [
    ...(categories.value ?? []),
  ]
    .filter(category => (!kind || category.kind === kind) && (!category.archived || picked.includes(category.id)))
    .sort((a, b) => (a.kind === b.kind
      ? a.order - b.order
      : a.kind === 'expense'
        ? -1
        : 1))
    .map(category => ({
      id: category.id,
      label: categoryName(category),
      icon: category.icon,
      color: category.color,
    }))
})

// Payment method filter: the active ones; archived ones only if picked.
const paymentFilterOpen = ref(false)
const filterPayments = computed<FilterItem[]>(() => (paymentMethods.value ?? [])
  .filter(method => !method.archived || filters.paymentIds.value.includes(method.id))
  .map(method => ({
    id: method.id,
    label: paymentMethodName(method),
    icon: method.icon,
  })))

/** With a single account there is nothing to transfer, unless the history says otherwise. */
const showsTransfers = computed(() => (accounts.value ?? []).filter(account => !account.archived).length >= 2
  || filters.kind.value === 'transfer'
  || (transactions.value ?? []).some(transaction => transaction.kind === 'transfer'))

const UNITS: PeriodUnit[] = ['day', 'week', 'month', 'year']

/** «Novembre 2026» when the range is a whole period, otherwise «1 nov – 15 nov». */
function rangeLabel(range: DateRange): string {
  for (const unit of UNITS) {
    const whole = periodRange({ unit, anchor: range.from })
    if (whole.from === range.from && whole.to === range.to)
      return periodLabel({ unit, anchor: range.from }, intlLocale.value)
  }
  const short = { day: 'numeric', month: 'short', year: 'numeric' } as const
  return `${formatDate(range.from, intlLocale.value, short)} – ${formatDate(range.to, intlLocale.value, short)}`
}

const periodChip = computed(() => filters.range.value
  ? rangeLabel(filters.range.value)
  : '')

const SWIPE_DELETE = computed<SwipeAction>(() => ({
  label: t('transactions.swipeDelete'),
  icon: 'trash',
  tone: 'danger',
}))
const SWIPE_DUPLICATE = computed<SwipeAction>(() => ({
  label: t('transactions.swipeDuplicate'),
  icon: 'copy',
  tone: 'pen',
}))

async function onSwipe(transaction: Transaction, direction: 'left' | 'right') {
  const subject = subjectOf(transaction)
  if (direction === 'left') {
    await deleteTransaction(transaction.id)
    showDeleted(transaction, subject)
  }
  else {
    const copy = await duplicateTransaction(transaction.id, today())
    showDuplicated(copy, subject)
  }
}

const empty = computed(() => {
  if (!transactions.value || visible.value.length)
    return null
  if (filters.search.value) {
    return {
      title: t('transactions.noResultsTitle', { query: filters.search.value }),
      hint: t('transactions.noResultsHint'),
      icon: true,
    }
  }
  if (filters.active.value || accountId.value) {
    return {
      title: t('transactions.noMatchTitle'),
      hint: t('transactions.noMatchHint'),
      icon: false,
    }
  }
  return {
    title: t('transactions.emptyTitle'),
    hint: t('transactions.emptyHint'),
    icon: false,
  }
})
</script>

<template>
  <AppPage :title="t('nav.transactions')">
    <template #actions>
      <AccountSelector />
    </template>

    <SearchField v-model="searchText" :placeholder="t('transactions.search')" />

    <div class="transactions__filters" role="group" :aria-label="t('transactions.filters')">
      <FilterChip :label="t('transactions.all')" :pressed="!filters.kind.value" @click="filters.setKind(null)" />
      <FilterChip
        :label="t('transactions.expenses')"
        :pressed="filters.kind.value === 'expense'"
        @click="filters.setKind('expense')"
      />
      <FilterChip
        :label="t('transactions.income')"
        :pressed="filters.kind.value === 'income'"
        @click="filters.setKind('income')"
      />
      <FilterChip
        v-if="showsTransfers"
        :label="t('transactions.transfers')"
        :pressed="filters.kind.value === 'transfer'"
        @click="filters.setKind('transfer')"
      />
      <FilterChip
        v-if="filters.kind.value !== 'transfer'"
        :label="filters.categoryIds.value.length
          ? t('transactions.categoryCount', { count: filters.categoryIds.value.length })
          : t('transactions.category')"
        :pressed="filters.categoryIds.value.length > 0"
        icon="caret-down"
        aria-haspopup="dialog"
        @click="filterOpen = true"
      />
      <FilterChip
        v-if="filters.kind.value !== 'transfer' && filters.kind.value !== 'income'"
        :label="filters.paymentIds.value.length
          ? t('transactions.paymentCount', { count: filters.paymentIds.value.length })
          : t('transactions.payment')"
        :pressed="filters.paymentIds.value.length > 0"
        icon="caret-down"
        aria-haspopup="dialog"
        @click="paymentFilterOpen = true"
      />
      <FilterChip
        v-if="periodChip"
        :label="periodChip"
        pressed
        icon="x"
        :aria-label="t('transactions.removePeriod', { period: periodChip })"
        @click="filters.clearRange()"
      />
    </div>

    <div v-if="empty" class="transactions__empty">
      <AppIcon v-if="empty.icon" name="magnifying-glass" class="transactions__empty-icon" />
      <p class="type-body-strong">
        {{ empty.title }}
      </p>
      <p class="transactions__empty-hint type-small">
        {{ empty.hint }}
      </p>
    </div>

    <template v-else>
      <TransitionGroup
        :key="listKey"
        tag="div"
        class="transactions__days"
        :css="false"
        @enter="onDayEnter"
        @leave="collapse"
      >
        <DayGroup v-for="day in shownDays" :key="day.date" :date="day.date" :total-cents="day.totalCents">
          <li v-for="transaction in day.transactions" :key="transaction.id">
            <SwipeRow
              :left-action="SWIPE_DELETE"
              :right-action="SWIPE_DUPLICATE"
              @swipe="onSwipe(transaction, $event)"
            >
              <TransactionRow
                :transaction="transaction"
                :category="categoryOf(transaction)"
                :account="accountOf(transaction)"
                :payment="paymentOf(transaction)"
              />
            </SwipeRow>
          </li>
        </DayGroup>
      </TransitionGroup>
      <div ref="sentinel" class="transactions__sentinel" aria-hidden="true" />
    </template>

    <FilterSheet
      v-model:open="filterOpen"
      :title="t('categoryFilter.title')"
      :all-label="t('categoryFilter.all')"
      :items="filterCategories"
      :selected="filters.categoryIds.value"
      @apply="filters.setCategories"
    />
    <FilterSheet
      v-model:open="paymentFilterOpen"
      :title="t('paymentFilter.title')"
      :all-label="t('paymentFilter.all')"
      :items="filterPayments"
      :selected="filters.paymentIds.value"
      @apply="filters.setPayments"
    />
  </AppPage>
</template>

<style scoped>
.transactions__filters {
  display: flex;
  gap: 0.5rem;
  margin-inline: calc(-1 * var(--page-gutter));
  padding: 0.375rem var(--page-gutter);
  overflow-x: auto;
  scrollbar-width: none;
}

/*
 * Each day keeps 24 px below itself, also the last one (the list takes it back): a day
 * that closes takes its space away with it, wherever it is.
 */
.transactions__days {
  margin-top: 0.5rem;
  margin-bottom: -1.5rem;
}

.transactions__days > * {
  margin-bottom: 1.5rem;
}

.transactions__sentinel {
  height: 1px;
}

.transactions__empty {
  margin-top: 1.5rem;
}

.transactions__empty p {
  margin: 0;
}

.transactions__empty-icon {
  --app-icon-size: 2rem;

  margin-bottom: 0.75rem;
  color: var(--color-ink-2);
}

.transactions__empty .transactions__empty-hint {
  margin-top: 0.25rem;
  color: var(--color-ink-2);
}
</style>
