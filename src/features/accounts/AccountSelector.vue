<script setup lang="ts">
import type { Choice } from '@/components/ChoiceList.vue'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import { accountName } from '@/db/names'
import { listAccounts } from '@/db/repositories/accounts'
import { useLiveQuery } from '@/db/useLiveQuery'
import { useAccountFilterStore } from '@/stores/account-filter'
import { useAccountBalances } from './useAccountBalances'

/**
 * The account Home and Movimenti show (mockup "Selettore del conto"). It stays out of sight with a
 * single account. An archived account can be chosen only from its own page, and stays here while
 * it is the chosen one; one that no longer exists goes back to «Tutti i conti».
 */
const ALL = 'all'

const { t } = useI18n()
const store = useAccountFilterStore()
const { accountId } = storeToRefs(store)

const { data: rows } = useLiveQuery(() => listAccounts({ includeArchived: true }))
const active = computed(() => (rows.value ?? []).filter(account => !account.archived))
const chosen = computed(() => (rows.value ?? []).find(account => account.id === accountId.value))
const visible = computed(() => active.value.length >= 2 || !!chosen.value)

watch(rows, (accounts) => {
  if (accounts && accountId.value && !chosen.value)
    store.select(null)
})

const open = ref(false)
const balances = useAccountBalances(rows, open)
const total = computed(() => active.value.reduce((sum, account) => sum + (balances.value.get(account.id) ?? 0), 0))

const label = computed(() => chosen.value
  ? accountName(chosen.value)
  : t('accountSelector.all'))

const choices = computed<Choice[]>(() => [
  {
    id: ALL,
    title: t('accountSelector.all'),
    icon: 'wallet',
    cents: total.value,
    strong: true,
  },
  ...[
    ...active.value,
    ...(chosen.value?.archived
      ? [chosen.value]
      : []),
  ].map(account => ({
    id: account.id,
    title: accountName(account),
    icon: account.icon,
    color: account.color,
    cents: balances.value.get(account.id) ?? 0,
  })),
])

function select(id: string) {
  store.select(id === ALL
    ? null
    : id)
  open.value = false
}
</script>

<template>
  <template v-if="visible">
    <button
      type="button"
      class="account-selector"
      :aria-label="t('accountSelector.label', { name: label })"
      aria-haspopup="dialog"
      @click="open = true"
    >
      <AppIcon name="wallet" class="account-selector__icon" />
      <span class="account-selector__label">{{ label }}</span>
      <AppIcon name="caret-down" class="account-selector__caret" />
    </button>

    <BottomSheet v-model="open" :title="t('accountSelector.title')">
      <ChoiceList :choices="choices" :selected="accountId ?? ALL" :aria-label="t('accountSelector.title')" @select="select" />
      <RouterLink :to="{ name: 'accounts' }" class="account-selector__manage">
        <AppIcon name="gear-six" />
        {{ t('accountSelector.manage') }}
      </RouterLink>
    </BottomSheet>
  </template>
</template>

<style scoped>
.account-selector {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 0.25rem;
  background: none;
  border: 0;
  border-radius: var(--rounded);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .account-selector:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.account-selector:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.account-selector:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .account-selector {
    transition: none;
  }
}

.account-selector__icon {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
}

.account-selector__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-selector__caret {
  --app-icon-size: 0.875rem;

  flex-shrink: 0;
}

.account-selector__manage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  margin-top: 0.625rem;
  color: var(--color-pen);
  font-weight: 600;
  text-decoration: none;
}

@media (hover: hover) {
  .account-selector__manage:hover {
    color: var(--color-pen-hover);
  }
}

.account-selector__manage:active {
  color: var(--color-pen-pressed);
}

.account-selector__manage:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: var(--rounded);
}

.account-selector__manage .app-icon {
  --app-icon-size: 1.125rem;
}
</style>
