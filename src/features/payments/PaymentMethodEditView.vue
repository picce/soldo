<script setup lang="ts">
import type { Account, PaymentMethod } from '@/db/schema'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { goBack } from '@/app/navigation'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import IconButton from '@/components/IconButton.vue'
import IconPicker from '@/components/IconPicker.vue'
import SubPage from '@/components/SubPage.vue'
import TextField from '@/components/TextField.vue'
import { accountName, paymentMethodName } from '@/db/names'
import { getDefaultAccount, listAccounts } from '@/db/repositories/accounts'
import {
  archivePaymentMethod,
  countPaymentMethodTransactions,
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  MAX_PAYMENT_METHOD_NAME,
  restorePaymentMethod,
  unarchivePaymentMethod,
  updatePaymentMethod,
} from '@/db/repositories/payment-methods'
import { countRecurrenceUses } from '@/db/repositories/recurrences'
import { normalizeText } from '@/domain/search'
import AccountSheet from '@/features/accounts/AccountSheet.vue'
import { PAYMENT_ICONS, paymentIconKey } from './icons'

/**
 * New payment method and changes to one (mockup "Modifica pagamento"): name, icon and the account
 * its expenses come out of. The choice of account shows with at least two active accounts.
 */
const props = defineProps<{
  /** Null for a new payment method. */
  id: string | null
}>()

const { t } = useI18n()
const router = useRouter()
const back = { name: 'payment-methods' }

const method = shallowRef<PaymentMethod>()
/** The other methods, archived too: a name cannot repeat. */
const others = shallowRef<PaymentMethod[]>([])
const accounts = shallowRef<Account[]>([])
const ready = ref(false)
const name = ref('')
const icon = ref<string>(PAYMENT_ICONS[0])
const accountId = ref('')
const usage = ref(0)
/** Series paid this way: with any, it can be archived but not deleted. */
const ruleUsage = ref(0)
const submitted = ref(false)
const busy = ref(false)
const accountOpen = ref(false)
const nameField = useTemplateRef<InstanceType<typeof TextField>>('nameField')

async function load() {
  accounts.value = await listAccounts({ includeArchived: true })
  if (props.id) {
    const found = await getPaymentMethod(props.id)
    if (!found) {
      void router.replace(back)
      return
    }
    method.value = found
    name.value = paymentMethodName(found)
    icon.value = found.icon
    accountId.value = found.accountId
    usage.value = await countPaymentMethodTransactions(found.id)
    ruleUsage.value = await countRecurrenceUses({ paymentMethodId: found.id })
  }
  else {
    accountId.value = (await getDefaultAccount())?.id ?? ''
  }
  others.value = (await listPaymentMethods({ includeArchived: true })).filter(other => other.id !== props.id)
  ready.value = true
}
void load()

const title = computed(() => {
  if (!props.id)
    return t('paymentEdit.new')
  return method.value
    ? paymentMethodName(method.value)
    : t('paymentEdit.edit')
})

const cleanName = computed(() => name.value.trim().replace(/\s+/g, ' '))

const nameError = computed(() => {
  if (!cleanName.value) {
    return submitted.value
      ? t('paymentEdit.nameRequired')
      : ''
  }
  const typed = normalizeText(cleanName.value)
  return others.value.some(other => normalizeText(paymentMethodName(other)) === typed)
    ? t('paymentEdit.nameTaken')
    : ''
})

const nameHint = computed(() => {
  const preset = method.value?.preset
  return preset && !method.value?.name && cleanName.value === paymentMethodName({ preset })
    ? t('paymentEdit.defaultName')
    : undefined
})

const iconOptions = computed(() => PAYMENT_ICONS.map(value => ({
  value,
  label: t(paymentIconKey(value)),
})))

/** Active accounts, and the linked one even if archived. */
const accountChoices = computed(() => accounts.value.filter(account => !account.archived || account.id === accountId.value))
const showsAccount = computed(() => accounts.value.filter(account => !account.archived).length >= 2)
const linkedAccount = computed(() => accounts.value.find(account => account.id === accountId.value))

const isLastActive = computed(() => !!method.value && !method.value.archived && !others.value.some(other => !other.archived))
const deletable = computed(() => !!method.value && usage.value === 0 && ruleUsage.value === 0 && !isLastActive.value)

/** Runs one change at a time, then goes back to the list; on failure it stays here. */
async function run(change: () => Promise<void>) {
  if (busy.value)
    return
  busy.value = true
  try {
    await change()
    goBack(router, back)
  }
  catch {
    showToast({
      message: t('common.saveError'),
    })
  }
  finally {
    busy.value = false
  }
}

function save() {
  submitted.value = true
  if (nameError.value) {
    nameField.value?.focus()
    return
  }
  void run(async () => {
    const fields = { name: cleanName.value, icon: icon.value, accountId: accountId.value }
    if (!method.value) {
      const created = await createPaymentMethod(fields)
      showToast({
        message: t('paymentEdit.added', {
          name: paymentMethodName(created),
        }),
      })
      return
    }
    await updatePaymentMethod(method.value.id, fields)
  })
}

function archive() {
  const current = method.value
  if (!current)
    return
  void run(async () => {
    await archivePaymentMethod(current.id)
    showToast({
      message: t('paymentEdit.archivedToast', {
        name: paymentMethodName(current),
      }),
      action: {
        label: t('common.undo'),
        run: () => unarchivePaymentMethod(current.id, current.order),
      },
    })
  })
}

function unarchive() {
  const current = method.value
  if (!current)
    return
  void run(async () => {
    await unarchivePaymentMethod(current.id)
    showToast({
      message: t('paymentEdit.unarchivedToast', {
        name: paymentMethodName(current),
      }),
    })
  })
}

function remove() {
  const current = method.value
  if (!current)
    return
  void run(async () => {
    await deletePaymentMethod(current.id)
    showToast({
      message: t('paymentEdit.deletedToast', {
        name: paymentMethodName(current),
      }),
      action: {
        label: t('common.undo'),
        run: () => restorePaymentMethod(current.id),
      },
    })
  })
}
</script>

<template>
  <SubPage :title="title" :back="back">
    <template v-if="deletable" #actions>
      <IconButton icon="trash" tone="danger" :label="t('paymentEdit.delete')" :disabled="busy" @click="remove" />
    </template>

    <template v-if="ready">
      <TextField
        ref="nameField"
        v-model="name"
        :label="t('paymentEdit.name')"
        :hint="nameHint"
        :error="nameError"
        :maxlength="MAX_PAYMENT_METHOD_NAME"
        autocomplete="off"
        enterkeyhint="done"
        @keydown.enter.prevent="save"
      />

      <section class="payment-edit__section" aria-labelledby="payment-icon-title">
        <h2 id="payment-icon-title" class="payment-edit__title type-label">
          {{ t('paymentEdit.icon') }}
        </h2>
        <IconPicker v-model="icon" :options="iconOptions" aria-labelledby="payment-icon-title" />
      </section>

      <section v-if="showsAccount" class="payment-edit__section" aria-labelledby="payment-account-title">
        <h2 id="payment-account-title" class="payment-edit__title type-label">
          {{ t('paymentEdit.account') }}
        </h2>
        <button type="button" class="payment-edit__account" aria-haspopup="dialog" @click="accountOpen = true">
          <AppIcon
            v-if="linkedAccount"
            :name="linkedAccount.icon"
            :style="{ color: `var(--color-category-${linkedAccount.color})` }"
          />
          <span class="type-body">{{ linkedAccount ? accountName(linkedAccount) : '' }}</span>
          <AppIcon name="caret-right" class="payment-edit__account-caret" />
        </button>
        <p class="payment-edit__note type-small">
          {{ t('paymentEdit.accountHint') }}
        </p>
      </section>

      <p v-if="method?.archived" class="payment-edit__note type-small">
        {{ t('paymentEdit.archivedNote') }}
      </p>
      <p v-else-if="isLastActive" class="payment-edit__note type-small">
        {{ t('paymentEdit.lastMethod') }}
      </p>
      <p v-else-if="usage > 0" class="payment-edit__note type-small">
        {{ t('paymentEdit.usage', usage) }}
      </p>
      <p v-else-if="ruleUsage > 0" class="payment-edit__note type-small">
        {{ t('paymentEdit.ruleUsage') }}
      </p>
    </template>

    <template v-if="ready" #footer>
      <VvButton
        v-if="method?.archived"
        :label="t('paymentEdit.unarchive')"
        modifiers="secondary"
        class="payment-edit__action"
        :disabled="busy"
        @click="unarchive"
      >
        <template #before>
          <AppIcon name="arrow-counter-clockwise" class="payment-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        v-else-if="method && !isLastActive"
        :label="t('paymentEdit.archive')"
        modifiers="secondary"
        class="payment-edit__action"
        :disabled="busy"
        @click="archive"
      >
        <template #before>
          <AppIcon name="archive" class="payment-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        :label="t('paymentEdit.save')"
        modifiers="primary"
        class="payment-edit__action"
        :disabled="busy"
        @click="save"
      >
        <template #before>
          <AppIcon name="check" class="payment-edit__action-icon" />
        </template>
      </VvButton>
    </template>

    <AccountSheet
      v-model:open="accountOpen"
      :accounts="accountChoices"
      :selected="accountId"
      :title="t('paymentEdit.account')"
      @select="accountId = $event"
    />
  </SubPage>
</template>

<style scoped>
.payment-edit__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.payment-edit__title {
  margin: 0;
}

.payment-edit__note {
  margin: 0;
  color: var(--color-ink-2);
}

.payment-edit__account {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .payment-edit__account:hover {
    background: var(--color-hover);
  }
}

.payment-edit__account:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.payment-edit__account:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .payment-edit__account {
    transition: none;
  }
}

.payment-edit__account .type-body {
  flex: 1;
}

.payment-edit__account-caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}

.payment-edit__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.payment-edit__action-icon {
  --app-icon-size: 1.25rem;
}
</style>
