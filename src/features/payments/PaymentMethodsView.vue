<script setup lang="ts">
import type { PaymentMethod } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import ArchivedSection from '@/components/ArchivedSection.vue'
import SortableList from '@/components/SortableList.vue'
import SubPage from '@/components/SubPage.vue'
import { accountName, paymentMethodName } from '@/db/names'
import { listAccounts } from '@/db/repositories/accounts'
import { listPaymentMethods, reorderPaymentMethods } from '@/db/repositories/payment-methods'
import { useLiveQuery } from '@/db/useLiveQuery'
import PaymentMethodLink from './PaymentMethodLink.vue'

/**
 * Payment methods (docs/specs/released/conti-pagamenti-trasferimenti.md), each tied to the account its
 * expenses come out of. Archived ones wait in a closed section at the end.
 */
const { t } = useI18n()

const { data: rows } = useLiveQuery(() => listPaymentMethods({ includeArchived: true }))
const { data: accounts } = useLiveQuery(() => listAccounts({ includeArchived: true }))
const active = computed(() => rows.value?.filter(method => !method.archived))
const archived = computed(() => (rows.value ?? []).filter(method => method.archived))

/** The linked account, unless its name would repeat the method's («Contanti / Contanti»). */
function accountOf(method: PaymentMethod): string | undefined {
  const account = accounts.value?.find(item => item.id === method.accountId)
  const name = account
    ? accountName(account)
    : undefined
  return name === paymentMethodName(method)
    ? undefined
    : name
}
</script>

<template>
  <SubPage :title="t('payments.title')" :back="{ name: 'settings' }">
    <SortableList
      :source="active"
      :persist="reorderPaymentMethods"
      :name-of="paymentMethodName"
      :aria-label="t('payments.list')"
    >
      <template #row="{ item }">
        <PaymentMethodLink :method="item" :account="accountOf(item)" />
      </template>
    </SortableList>

    <ArchivedSection v-if="archived.length" :label="t('payments.archived', { count: archived.length })">
      <ul class="payments__archived">
        <li v-for="method in archived" :key="method.id">
          <PaymentMethodLink :method="method" :account="accountOf(method)" />
        </li>
      </ul>
    </ArchivedSection>

    <p class="payments__hint type-small">
      {{ t('payments.hint') }}
    </p>

    <template #footer>
      <VvButton :to="{ name: 'payment-method-edit', params: { id: 'nuovo' } }" :label="t('payments.new')" modifiers="secondary" class="payments__new">
        <template #before>
          <AppIcon name="plus" weight="regular" class="payments__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.payments__archived {
  margin: 0.75rem 0 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.payments__archived li {
  display: flex;
  padding-inline-start: 0.875rem;
}

.payments__archived li + li {
  border-top: 1px solid var(--color-line);
}

.payments__hint {
  margin: 0;
  color: var(--color-ink-2);
}

.payments__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.payments__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
