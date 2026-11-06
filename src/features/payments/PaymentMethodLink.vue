<script setup lang="ts">
import type { PaymentMethod } from '@/db/schema'
import AppIcon from '@/components/AppIcon.vue'
import { paymentMethodName } from '@/db/names'

/** Row of the payment methods list that opens the method (mockup "Tipi di pagamento"). */
defineProps<{
  method: PaymentMethod
  /** Name of the linked account; left out by the list when it would repeat the method's. */
  account?: string
}>()
</script>

<template>
  <RouterLink :to="{ name: 'payment-method-edit', params: { id: method.id } }" class="payment-link" draggable="false">
    <AppIcon :name="method.icon" class="payment-link__icon" />
    <span class="payment-link__text">
      <span class="payment-link__name type-body">{{ paymentMethodName(method) }}</span>
      <span v-if="account" class="payment-link__detail type-small">{{ account }}</span>
    </span>
    <AppIcon name="caret-right" class="payment-link__caret" />
  </RouterLink>
</template>

<style scoped>
.payment-link {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 2.75rem;
  padding-block: 0.375rem;
  padding-inline-end: 0.875rem;
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .payment-link:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.payment-link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.payment-link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .payment-link {
    transition: none;
  }
}

.payment-link__icon {
  --app-icon-size: 1.375rem;

  flex-shrink: 0;
}

.payment-link__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.payment-link__name,
.payment-link__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-link__detail {
  color: var(--color-ink-2);
}

.payment-link__caret {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}
</style>
