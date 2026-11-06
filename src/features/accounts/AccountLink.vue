<script setup lang="ts">
import type { Account } from '@/db/schema'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import { accountName } from '@/db/names'

/** Row of the accounts list that opens the account (mockup "Conti"): color, icon, name, balance. */
defineProps<{
  account: Account
  balance?: number
  detail?: string
}>()
</script>

<template>
  <RouterLink :to="{ name: 'account-edit', params: { id: account.id } }" class="account-link" draggable="false">
    <span class="account-link__square" :style="{ background: `var(--color-category-${account.color})` }" aria-hidden="true" />
    <AppIcon :name="account.icon" class="account-link__icon" />
    <span class="account-link__text">
      <span class="account-link__name type-body">{{ accountName(account) }}</span>
      <span v-if="detail" class="account-link__detail type-small">{{ detail }}</span>
    </span>
    <AmountText v-if="balance !== undefined" :cents="balance" />
    <AppIcon name="caret-right" class="account-link__caret" />
  </RouterLink>
</template>

<style scoped>
.account-link {
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
  .account-link:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.account-link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.account-link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .account-link {
    transition: none;
  }
}

.account-link__square {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}

.account-link__icon {
  --app-icon-size: 1.375rem;

  flex-shrink: 0;
}

.account-link__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.account-link__name,
.account-link__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-link__detail {
  color: var(--color-ink-2);
}

.account-link__caret {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}
</style>
