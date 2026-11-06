<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import ArchivedSection from '@/components/ArchivedSection.vue'
import SortableList from '@/components/SortableList.vue'
import SubPage from '@/components/SubPage.vue'
import { accountName } from '@/db/names'
import { listAccounts, reorderAccounts } from '@/db/repositories/accounts'
import { useLiveQuery } from '@/db/useLiveQuery'
import AccountLink from './AccountLink.vue'
import { useAccountBalances } from './useAccountBalances'

/**
 * Accounts (docs/specs/released/conti-pagamenti-trasferimenti.md): each with its current balance, and the
 * total of the active ones. The first of the list is the default account.
 */
const { t } = useI18n()

const { data: rows } = useLiveQuery(() => listAccounts({ includeArchived: true }))
const active = computed(() => rows.value?.filter(account => !account.archived))
const archived = computed(() => (rows.value ?? []).filter(account => account.archived))

const balances = useAccountBalances(rows)
const total = computed(() => (active.value ?? []).reduce((sum, account) => sum + (balances.value.get(account.id) ?? 0), 0))
</script>

<template>
  <SubPage :title="t('accounts.title')" :back="{ name: 'settings' }">
    <div class="accounts__total">
      <span class="type-body-strong">{{ t('accounts.total') }}</span>
      <span class="accounts__dots" aria-hidden="true" />
      <AmountText :cents="total" currency />
    </div>

    <SortableList
      :source="active"
      :persist="reorderAccounts"
      :name-of="accountName"
      :aria-label="t('accounts.list')"
    >
      <template #row="{ item, index }">
        <AccountLink
          :account="item"
          :balance="balances.get(item.id)"
          :detail="index === 0 ? t('accounts.default') : undefined"
        />
      </template>
    </SortableList>

    <ArchivedSection v-if="archived.length" :label="t('accounts.archived', { count: archived.length })">
      <ul class="accounts__archived">
        <li v-for="account in archived" :key="account.id">
          <AccountLink :account="account" :balance="balances.get(account.id)" />
        </li>
      </ul>
    </ArchivedSection>

    <p class="accounts__hint type-small">
      {{ t('accounts.hint') }}
    </p>

    <template #footer>
      <VvButton :to="{ name: 'account-edit', params: { id: 'nuovo' } }" :label="t('accounts.new')" modifiers="secondary" class="accounts__new">
        <template #before>
          <AppIcon name="plus" weight="regular" class="accounts__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.accounts__total {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.accounts__dots {
  flex: 1;
  height: 0;
  border-bottom: 1px dashed var(--color-line);
}

.accounts__archived {
  margin: 0.75rem 0 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.accounts__archived li {
  display: flex;
  padding-inline-start: 0.875rem;
}

.accounts__archived li + li {
  border-top: 1px solid var(--color-line);
}

.accounts__hint {
  margin: 0;
  color: var(--color-ink-2);
}

.accounts__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.accounts__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
