<script setup lang="ts">
import type { Category, Transaction } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import { categoryName } from '@/db/names'
import { signedCents } from '@/domain/days'

/**
 * A transaction in the list (mockup "Movimenti"): icon in the category color, the note
 * (or the category, without a note), category and payment method or account below, the amount on
 * the right. A transfer has its own icon, its two accounts and an amount with no sign. It opens
 * the edit screen. One added by a series has a small `repeat` icon before its detail.
 */
const props = defineProps<{
  transaction: Transaction
  category?: Category
  /** Name of the account; for a transfer, both sides («Banca → Contanti»). */
  account: string
  /** Name of the payment method of an expense: it says more than the account it comes from. */
  payment?: string
}>()

const { t } = useI18n()

const isTransfer = computed(() => props.transaction.kind === 'transfer')
const name = computed(() => props.category
  ? categoryName(props.category)
  : '')
const title = computed(() => props.transaction.note || (isTransfer.value
  ? t('transactions.transfer')
  : name.value))
const detail = computed(() => [
  props.transaction.note ? name.value : '',
  props.payment || props.account,
].filter(Boolean).join(' · '))
// A transfer has no sign and no color: it moves money without adding or taking any.
const cents = computed(() => isTransfer.value
  ? props.transaction.amountCents
  : signedCents(props.transaction))
</script>

<template>
  <RouterLink
    :to="{ name: 'transaction-edit', params: { id: transaction.id } }"
    class="transaction-row"
    draggable="false"
  >
    <AppIcon
      :name="isTransfer ? 'arrows-left-right' : category?.icon ?? 'receipt'"
      class="transaction-row__icon"
      :class="{ 'transaction-row__icon--transfer': isTransfer }"
      :style="{ color: category ? `var(--color-category-${category.color})` : undefined }"
    />
    <span class="transaction-row__text">
      <span class="transaction-row__title type-body">{{ title }}</span>
      <span v-if="detail || transaction.recurrenceId" class="transaction-row__detail type-small">
        <template v-if="transaction.recurrenceId">
          <AppIcon name="repeat" class="transaction-row__repeat" />
          <span class="sr-only">{{ t('transactions.recurring') }}</span>
        </template>{{ detail }}
      </span>
    </span>
    <AmountText v-if="isTransfer" :cents="cents" />
    <AmountText v-else :cents="cents" :sign="cents > 0 ? 'always' : 'auto'" colored />
  </RouterLink>
</template>

<style scoped>
.transaction-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.75rem;
  padding: 0.5rem 1rem;
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .transaction-row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.transaction-row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.transaction-row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

.transaction-row__icon {
  --app-icon-size: 1.375rem;
}

.transaction-row__icon--transfer {
  color: var(--color-ink-2);
}

.transaction-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.transaction-row__title,
.transaction-row__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transaction-row__detail {
  color: var(--color-ink-2);
}

/* A transaction added by a series (docs/specs/ricorrenze.md). */
.transaction-row__repeat {
  --app-icon-size: 0.875rem;

  margin-inline-end: 0.25rem;
  vertical-align: -0.125em;
}
</style>
