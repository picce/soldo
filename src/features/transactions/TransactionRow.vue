<script setup lang="ts">
import type { Category, Transaction } from '@/db/schema'
import { computed } from 'vue'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import { categoryName } from '@/db/names'
import { signedCents } from '@/domain/days'

/**
 * A transaction in the list (mockup "Movimenti"): icon in the category color, the note
 * (or the category, without a note), category and account below, the amount on the right.
 * It opens the edit screen.
 */
const props = defineProps<{
  transaction: Transaction
  category?: Category
  account: string
}>()

const name = computed(() => props.category
  ? categoryName(props.category)
  : '')
const title = computed(() => props.transaction.note || name.value)
const detail = computed(() => [
  props.transaction.note ? name.value : '',
  props.account,
].filter(Boolean).join(' · '))
const cents = computed(() => signedCents(props.transaction))
</script>

<template>
  <RouterLink
    :to="{ name: 'transaction-edit', params: { id: transaction.id } }"
    class="transaction-row"
    draggable="false"
  >
    <AppIcon
      :name="category?.icon ?? 'receipt'"
      class="transaction-row__icon"
      :style="{ color: category ? `var(--color-category-${category.color})` : undefined }"
    />
    <span class="transaction-row__text">
      <span class="transaction-row__title type-body">{{ title }}</span>
      <span v-if="detail" class="transaction-row__detail type-small">{{ detail }}</span>
    </span>
    <AmountText :cents="cents" :sign="cents > 0 ? 'always' : 'auto'" colored />
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
</style>
