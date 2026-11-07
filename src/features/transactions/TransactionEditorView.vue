<script setup lang="ts">
import type { EditorKind, EditorTarget } from './useTransactionEditor'
import type { CalculatorKey } from '@/domain/calculator'
import { useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { needsEdgeSwipe, useEdgeSwipeBack } from '@/app/gestures'
import { goBack } from '@/app/navigation'
import ActionChip from '@/components/ActionChip.vue'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import IconButton from '@/components/IconButton.vue'
import Keypad from '@/components/Keypad.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { accountName } from '@/db/names'
import {
  formatExpression,
  formatOperand,
  hasOperator,
  isDigit,
  isEmptyCalculator,
  isOperator,
} from '@/domain/calculator'
import { addDays, formatDate, today } from '@/domain/dates'
import { currencyPlacement, formatAmount, MINUS } from '@/domain/money'
import AccountSheet from '@/features/accounts/AccountSheet.vue'
import { useAccountBalances } from '@/features/accounts/useAccountBalances'
import PaymentMethodSheet from '@/features/payments/PaymentMethodSheet.vue'
import { describeEvery, describeShort } from '@/features/recurrences/describe'
import { useIntlLocale } from '@/i18n/locale'
import DateSheet from './DateSheet.vue'
import NoteSheet from './NoteSheet.vue'
import { useTransactionEditor } from './useTransactionEditor'

/**
 * Quick add and edit of a transaction (docs/specs/released/aggiunta-rapida.md): amount on the
 * keypad, then a tap on the category saves. Editing adds Salva, Duplica and Elimina. An expense
 * also says how it is paid, an income on which account, and a transfer between which two
 * (docs/specs/released/conti-pagamenti-trasferimenti.md). The same screen makes and edits a series
 * (docs/specs/ricorrenze.md): «Ripeti» in the date sheet, and on a transaction of a series a row
 * that leads to it.
 */
const props = defineProps<{
  target: EditorTarget
}>()

const { t } = useI18n()
const router = useRouter()
const intlLocale = useIntlLocale()

/** Back to where the screen was opened from, or to a sensible page when opened directly. */
function close() {
  goBack(router, {
    name: {
      new: 'home',
      edit: 'transactions',
      rule: 'recurrences',
    }[props.target.mode],
  })
}

const {
  isEdit,
  isRule,
  rule,
  ruleState,
  repeat,
  ready,
  kind,
  calculator,
  amountCents,
  date,
  note,
  categories,
  selectedId,
  hint,
  shakeCount,
  canTransfer,
  accountRows,
  accountChoices,
  paymentChoices,
  showsAccountChoice,
  paymentMethodId,
  accountId,
  fromAccountId,
  toAccountId,
  fromAccount,
  toAccount,
  paymentLabel,
  accountLabel,
  press,
  selectCategory,
  selectPaymentMethod,
  selectAccount,
  selectFrom,
  selectTo,
  swapAccounts,
  save,
  duplicate,
  remove,
  stop,
  resume,
} = useTransactionEditor(props.target, {
  onDone: close,
  onNotFound: () => void router.replace({
    name: isRule ? 'recurrences' : 'transactions',
  }),
})

/** «Ripeti» in the date sheet: offered for a new transaction, always there for a series. */
const repeatMode = computed(() => {
  if (isRule)
    return 'required'
  return isEdit
    ? 'none'
    : 'optional'
})

const dateOpen = ref(false)
const noteOpen = ref(false)
const paymentOpen = ref(false)
const accountOpen = ref(false)
const fromOpen = ref(false)
const toOpen = ref(false)
const sheetOpen = computed(() => dateOpen.value || noteOpen.value || paymentOpen.value || accountOpen.value || fromOpen.value || toOpen.value)

// Next to «Da» and «A», only while a transfer is on screen: the balances read every transaction.
const isTransfer = computed(() => kind.value === 'transfer')
const balances = useAccountBalances(accountRows, isTransfer)
function balanceOf(id: string | null) {
  return id
    ? balances.value.get(id)
    : undefined
}

// On an installed iPhone app a swipe from the left edge closes, like Chiudi.
const page = useTemplateRef<HTMLElement>('page')
const edgeSwipe = needsEdgeSwipe()
const { offset, dragging } = useEdgeSwipeBack(page, close, edgeSwipe)

const kindOptions = computed<{ value: EditorKind, label: string }[]>(() => {
  const transfer = {
    value: 'transfer' as const,
    label: t('editor.transfer'),
  }
  // A saved transfer stays one, and an expense or an income cannot turn into one.
  if (isEdit && kind.value === 'transfer')
    return [transfer]
  return [
    {
      value: 'expense',
      label: t('editor.expense'),
    },
    {
      value: 'income',
      label: t('editor.income'),
    },
    ...(canTransfer.value || kind.value === 'transfer'
      ? [transfer]
      : []),
  ]
})

const title = computed(() => {
  if (isRule)
    return t('editor.editRule')
  if (isEdit)
    return t('editor.edit')
  return {
    expense: t('editor.newExpense'),
    income: t('editor.newIncome'),
    transfer: t('editor.newTransfer'),
  }[kind.value]
})

const showsExpression = computed(() => hasOperator(calculator.value))
const expression = computed(() => formatExpression(calculator.value, intlLocale.value))

/** The number as typed while there is no operation, otherwise the result with two decimals. */
const numberText = computed(() => {
  if (showsExpression.value)
    return formatAmount(Math.max(amountCents.value, 0), intlLocale.value, { sign: 'never' })
  if (isEmptyCalculator(calculator.value))
    return formatAmount(0, intlLocale.value)
  return formatOperand(calculator.value.operands[0] ?? '', intlLocale.value)
})

const sign = computed(() => {
  if (amountCents.value <= 0 || kind.value === 'transfer')
    return ''
  return kind.value === 'expense'
    ? MINUS
    : '+'
})

const currency = computed(() => currencyPlacement(intlLocale.value))

const dayLabel = computed(() => {
  const current = today()
  if (date.value === current)
    return t('dateSheet.today')
  if (date.value === addDays(current, -1))
    return t('dateSheet.yesterday')
  const sameYear = date.value.slice(0, 4) === current.slice(0, 4)
  return formatDate(date.value, intlLocale.value, {
    day: 'numeric',
    month: 'short',
    ...(sameYear
      ? {}
      : { year: 'numeric' }),
  })
})
/** «Oggi», or «Oggi · mensile» with a repeat. */
const dateLabel = computed(() => repeat.value
  ? `${dayLabel.value} · ${describeShort(repeat.value)}`
  : dayLabel.value)

// A physical keyboard works too: digits, comma or point, + − * / and Backspace.
const KEYBOARD_KEYS: Record<string, CalculatorKey> = {
  ',': 'decimal',
  '.': 'decimal',
  'Backspace': 'backspace',
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey || sheetOpen.value)
    return
  const element = event.target as HTMLElement | null
  if (element?.closest('input, textarea, dialog'))
    return
  const key = isDigit(event.key) || isOperator(event.key)
    ? event.key
    : KEYBOARD_KEYS[event.key]
  if (!key)
    return
  event.preventDefault()
  press(key)
})
</script>

<template>
  <div
    ref="page"
    class="editor"
    :class="{ 'editor--edit': isEdit, 'editor--edge-swipe': edgeSwipe, 'editor--dragging': dragging }"
    :style="offset ? { translate: `${offset}px 0` } : undefined"
  >
    <h1 class="sr-only">
      {{ title }}
    </h1>
    <header class="editor__top" :class="{ 'editor__top--wide': kindOptions.length > 2 }">
      <IconButton icon="x" :label="t('common.close')" @click="close" />
      <SegmentedControl v-model="kind" :options="kindOptions" :aria-label="t('editor.kind')" class="editor__kind" />
      <IconButton
        v-if="isEdit"
        icon="trash"
        tone="danger"
        :label="isRule ? t('editor.deleteRule') : t('editor.delete')"
        :disabled="!ready"
        class="editor__delete"
        @click="remove"
      />
    </header>

    <template v-if="ready">
      <section class="editor__amount" :aria-label="t('editor.amount')">
        <p v-if="hint" class="editor__line editor__line--hint type-body-strong" role="alert">
          {{ t(`editor.${hint}`) }}
        </p>
        <p v-else-if="showsExpression" class="editor__line type-note">
          {{ expression }}
        </p>
        <p v-else-if="isEdit" class="editor__line editor__line--label type-label">
          {{ isRule ? t('editor.rule') : t('editor.editing') }}
        </p>
        <p v-else class="editor__line" />
        <p
          :key="shakeCount"
          class="editor__value"
          :class="{
            'editor__value--shake': shakeCount > 0,
            'editor__value--long': numberText.length > 10,
            'editor__value--empty': amountCents <= 0,
          }"
          aria-live="polite"
          aria-atomic="true"
        >
          <span class="editor__number">{{ sign }}</span>
          <span v-if="currency.position === 'before'" class="editor__currency">{{ currency.symbol }}</span>
          <span class="editor__number">{{ numberText }}</span>
          <span v-if="currency.position === 'after'" class="editor__currency">&nbsp;{{ currency.symbol }}</span>
        </p>
      </section>

      <div class="editor__chips">
        <ActionChip
          :icon="repeat ? 'repeat' : 'calendar-blank'"
          class="editor__date-chip"
          :label="dateLabel"
          :aria-label="t('editor.dateChip', { date: dateLabel })"
          @click="dateOpen = true"
        />
        <ActionChip
          v-if="kind === 'expense'"
          icon="credit-card"
          class="editor__money-chip"
          :label="paymentLabel || t('editor.payment')"
          :aria-label="paymentLabel ? t('editor.paymentChip', { payment: paymentLabel }) : undefined"
          aria-haspopup="dialog"
          @click="paymentOpen = true"
        />
        <ActionChip
          v-else-if="kind === 'income' && showsAccountChoice"
          icon="wallet"
          class="editor__money-chip"
          :label="accountLabel"
          :aria-label="t('editor.accountChip', { account: accountLabel })"
          aria-haspopup="dialog"
          @click="accountOpen = true"
        />
        <ActionChip
          icon="note-pencil"
          :label="note || t('editor.note')"
          :aria-label="note ? t('editor.noteChip', { note }) : undefined"
          class="editor__note-chip"
          @click="noteOpen = true"
        />
        <ActionChip
          v-if="kind === 'transfer'"
          icon="arrows-down-up"
          class="editor__swap-chip"
          :label="t('editor.swap')"
          @click="swapAccounts"
        />
      </div>

      <p v-if="isRule" class="editor__rule-note type-small">
        {{ t('editor.ruleNote') }}
      </p>
      <p v-else-if="rule" class="editor__series type-small">
        <AppIcon name="repeat" class="editor__series-icon" />
        <span class="editor__series-every">{{ describeEvery(rule) }}</span>
        <RouterLink :to="{ name: 'recurrence-edit', params: { id: rule.id } }" class="editor__series-link">
          {{ t('editor.editSeries') }}
        </RouterLink>
      </p>

      <section v-if="kind === 'transfer'" class="editor__transfer" :aria-label="t('editor.transfer')">
        <div class="editor__sides">
          <button type="button" class="editor__side" aria-haspopup="dialog" @click="fromOpen = true">
            <span class="editor__side-label type-label">{{ t('editor.from') }}</span>
            <AppIcon v-if="fromAccount" :name="fromAccount.icon" :style="{ color: `var(--color-category-${fromAccount.color})` }" />
            <span class="editor__side-name type-body">{{ fromAccount ? accountName(fromAccount) : '' }}</span>
            <AmountText v-if="balanceOf(fromAccountId) !== undefined" :cents="balanceOf(fromAccountId)!" class="editor__side-balance" />
            <AppIcon name="caret-right" class="editor__side-caret" />
          </button>
          <button type="button" class="editor__side" aria-haspopup="dialog" @click="toOpen = true">
            <span class="editor__side-label type-label">{{ t('editor.to') }}</span>
            <AppIcon v-if="toAccount" :name="toAccount.icon" :style="{ color: `var(--color-category-${toAccount.color})` }" />
            <span class="editor__side-name type-body">{{ toAccount ? accountName(toAccount) : '' }}</span>
            <AmountText v-if="balanceOf(toAccountId) !== undefined" :cents="balanceOf(toAccountId)!" class="editor__side-balance" />
            <AppIcon name="caret-right" class="editor__side-caret" />
          </button>
        </div>
        <VvButton v-if="!isEdit" :label="t('editor.save')" modifiers="primary" class="editor__transfer-save" @click="save">
          <template #before>
            <AppIcon name="check" class="editor__action-icon" />
          </template>
        </VvButton>
      </section>

      <section v-else class="editor__categories" aria-labelledby="editor-categories-title">
        <div class="editor__categories-head">
          <h2 id="editor-categories-title" class="editor__categories-title type-label">
            {{ t('editor.category') }}
          </h2>
          <span class="type-note">{{ isEdit ? t('editor.tapToChange') : t('editor.tapToSave') }}</span>
        </div>
        <CategoryGrid
          :categories="categories"
          :selectable="isEdit"
          :selected-id="selectedId"
          @select="selectCategory"
        />
      </section>

      <div v-if="isEdit" class="editor__actions">
        <VvButton v-if="ruleState === 'active'" :label="t('editor.stop')" modifiers="secondary" class="editor__action" @click="stop">
          <template #before>
            <AppIcon name="pause" class="editor__action-icon" />
          </template>
        </VvButton>
        <VvButton v-else-if="ruleState === 'finished'" :label="t('editor.resume')" modifiers="secondary" class="editor__action" @click="resume">
          <template #before>
            <AppIcon name="play" class="editor__action-icon" />
          </template>
        </VvButton>
        <VvButton v-else-if="!isRule" :label="t('editor.duplicate')" modifiers="secondary" class="editor__action" @click="duplicate">
          <template #before>
            <AppIcon name="copy" class="editor__action-icon" />
          </template>
        </VvButton>
        <VvButton :label="t('editor.save')" modifiers="primary" class="editor__action" @click="save">
          <template #before>
            <AppIcon name="check" class="editor__action-icon" />
          </template>
        </VvButton>
      </div>

      <div class="editor__keypad">
        <Keypad @press="press" />
      </div>
    </template>

    <DateSheet v-model:open="dateOpen" v-model:date="date" v-model:repeat="repeat" :repeat-mode="repeatMode" />
    <NoteSheet v-model:open="noteOpen" v-model:note="note" />
    <PaymentMethodSheet
      v-model:open="paymentOpen"
      :methods="paymentChoices"
      :accounts="accountRows ?? []"
      :selected="paymentMethodId"
      @select="selectPaymentMethod"
    />
    <AccountSheet v-model:open="accountOpen" :accounts="accountChoices" :selected="accountId" @select="selectAccount" />
    <AccountSheet v-model:open="fromOpen" :title="t('editor.fromTitle')" :accounts="accountChoices.filter(account => account.id !== toAccountId)" :selected="fromAccountId" @select="selectFrom" />
    <AccountSheet v-model:open="toOpen" :title="t('editor.toTitle')" :accounts="accountChoices.filter(account => account.id !== fromAccountId)" :selected="toAccountId" @select="selectTo" />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 40rem;
  margin-inline: auto;
  padding-top: calc(0.75rem + env(safe-area-inset-top));
}

/* Swipe back from the edge: sideways moves are the page's, the vertical ones scroll. */
.editor--edge-swipe {
  touch-action: pan-y;
  transition: translate var(--motion-base) var(--motion-ease);
}

.editor--dragging {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .editor--edge-swipe {
    transition: none;
  }
}

.editor__top {
  display: grid;
  grid-template-columns: 2.75rem 1fr 2.75rem;
  align-items: center;
  gap: 0.5rem;
  padding-inline: var(--page-gutter);
}

.editor__kind {
  justify-self: center;
}

/* Three kinds take the whole row, down to 360 px. */
.editor__top--wide {
  grid-template-columns: 2.75rem 1fr;
}

.editor__top--wide .editor__kind {
  justify-self: stretch;
  min-width: 0;
}

.editor__top--wide .editor__kind :deep(.segmented-control__segment) {
  flex: 1 1 auto;
  padding-inline: 0.5rem;
}

.editor__delete {
  grid-column: 3;
}

.editor__amount {
  padding: 1.25rem var(--page-gutter) 0;
  text-align: end;
}

.editor__line {
  height: 1.25rem;
  line-height: 1.25rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor__line--hint {
  color: var(--color-danger);
}

.editor__line--label {
  color: var(--color-ink-2);
}

.editor__value {
  margin: 0;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--color-ink);
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1.25;
  white-space: nowrap;
}

.editor__value--empty {
  color: var(--color-ink-2);
}

.editor__value--long {
  font-size: 1.875rem;
}

.editor__currency {
  color: var(--color-ink-2);
  font-size: 0.8em;
}

.editor__value--shake {
  animation: editor-shake 0.32s ease;
}

@keyframes editor-shake {
  20% {
    translate: -6px 0;
  }
  40% {
    translate: 6px 0;
  }
  60% {
    translate: -4px 0;
  }
  80% {
    translate: 4px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor__value--shake {
    animation: none;
  }
}

.editor__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem var(--page-gutter) 0;
}

.editor__rule-note,
.editor__series {
  margin: 0;
  padding: 0.75rem var(--page-gutter) 0;
  color: var(--color-ink-2);
}

.editor__series {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor__series-icon {
  --app-icon-size: 1.125rem;
}

.editor__series-every {
  flex: 1;
}

.editor__series-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  margin-block: -0.75rem;
  color: var(--color-pen);
  font-weight: 600;
  text-decoration: none;
  transition: color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .editor__series-link:hover {
    color: var(--color-pen-hover);
  }
}

.editor__series-link:active {
  color: var(--color-pen-pressed);
  transition-duration: 0s;
}

.editor__series-link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .editor__series-link {
    transition: none;
  }
}

.editor__date-chip {
  flex-shrink: 0;
}

.editor__note-chip {
  flex-shrink: 1;
}

.editor__money-chip {
  flex-shrink: 1;
}

.editor__swap-chip {
  flex-shrink: 0;
  margin-inline-start: auto;
}

.editor__transfer {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem var(--page-gutter);
}

.editor__sides {
  overflow: hidden;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.editor__side {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  background: none;
  border: 0;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.editor__side + .editor__side {
  border-top: 1px solid var(--color-line);
}

@media (hover: hover) {
  .editor__side:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.editor__side:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.editor__side:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .editor__side {
    transition: none;
  }
}

.editor__side-label {
  width: 1.25rem;
  color: var(--color-ink-2);
}

.editor__side-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor__side-balance {
  color: var(--color-ink-2);
}

.editor__side-caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}

.editor__transfer-save {
  width: 100%;
  min-height: 3.25rem;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.editor__categories {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem var(--page-gutter) 1rem;
}

.editor__categories-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.editor__categories-title {
  margin: 0;
}

.editor__actions {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem var(--page-gutter);
  background: var(--color-paper);
  border-top: 1px solid var(--color-line);
}

.editor__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
}

.editor__action-icon {
  --app-icon-size: 1.25rem;
}

.editor__keypad {
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-card);
}

.editor--edit .editor__keypad {
  --keypad-key-height: 3.25rem;
}
</style>
