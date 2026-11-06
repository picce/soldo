<script setup lang="ts">
import type { Choice } from '@/components/ChoiceList.vue'
import type { Account, PaymentMethod } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import { accountName, paymentMethodName } from '@/db/names'

/**
 * How an expense is paid (mockup "Foglio del pagamento"). With at least two active accounts, each
 * row says the account it comes out of, unless the name would just repeat.
 */
const props = defineProps<{
  methods: PaymentMethod[]
  accounts: Account[]
  selected?: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const showsAccounts = computed(() => props.accounts.filter(account => !account.archived).length >= 2)

const choices = computed<Choice[]>(() => props.methods.map((method) => {
  const name = paymentMethodName(method)
  const account = props.accounts.find(item => item.id === method.accountId)
  const detail = showsAccounts.value && account
    ? accountName(account)
    : undefined
  return {
    id: method.id,
    title: name,
    icon: method.icon,
    detail: detail === name
      ? undefined
      : detail,
  }
}))

function select(id: string) {
  emit('select', id)
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('paymentSheet.title')">
    <ChoiceList :choices="choices" :selected="selected" :aria-label="t('paymentSheet.title')" @select="select" />
    <RouterLink :to="{ name: 'payment-methods' }" class="payment-sheet__manage">
      <AppIcon name="gear-six" />
      {{ t('paymentSheet.manage') }}
    </RouterLink>
  </BottomSheet>
</template>

<style scoped>
.payment-sheet__manage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  margin-top: 0.625rem;
  color: var(--color-pen);
  font-weight: 600;
  text-decoration: none;
  transition: color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .payment-sheet__manage:hover {
    color: var(--color-pen-hover);
  }
}

.payment-sheet__manage:active {
  color: var(--color-pen-pressed);
  transition-duration: 0s;
}

.payment-sheet__manage:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .payment-sheet__manage {
    transition: none;
  }
}

.payment-sheet__manage .app-icon {
  --app-icon-size: 1.125rem;
}
</style>
