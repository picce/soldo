<script setup lang="ts">
import type { Account, PaletteColor } from '@/db/schema'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { goBack } from '@/app/navigation'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import IconButton from '@/components/IconButton.vue'
import IconPicker from '@/components/IconPicker.vue'
import { colorNameKey } from '@/components/palette'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SubPage from '@/components/SubPage.vue'
import TextField from '@/components/TextField.vue'
import { accountName } from '@/db/names'
import {
  archiveAccount,
  countAccountTransactions,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  MAX_ACCOUNT_NAME,
  restoreAccount,
  unarchiveAccount,
  updateAccount,
} from '@/db/repositories/accounts'
import { countRecurrenceUses } from '@/db/repositories/recurrences'
import { formatAmount, parseAmount } from '@/domain/money'
import { normalizeText } from '@/domain/search'
import { suggestColor } from '@/features/categories/suggest'
import { useIntlLocale } from '@/i18n/locale'
import { useAccountFilterStore } from '@/stores/account-filter'
import { ACCOUNT_ICONS, accountIconKey, suggestAccountIcon } from './icons'

/**
 * New account and changes to one (mockup "Modifica conto"). Archivia hides it from the choices and
 * keeps it in the history; an account no transaction uses can also be deleted. The last active
 * account can do neither: a transaction could not be saved anywhere.
 */
const props = defineProps<{
  /** Null for a new account. */
  id: string | null
}>()

const { t } = useI18n()
const router = useRouter()
const intlLocale = useIntlLocale()
const filter = useAccountFilterStore()
const back = { name: 'accounts' }

const account = shallowRef<Account>()
/** The other accounts, archived too: a name cannot repeat. */
const others = shallowRef<Account[]>([])
const ready = ref(false)
const name = ref('')
const icon = ref('')
const color = ref<PaletteColor>(1)
const balanceText = ref('')
const balanceSign = ref<'positive' | 'negative'>('positive')
const usage = ref(0)
/** Series that use the account: with any, it can be archived but not deleted. */
const ruleUsage = ref(0)
const submitted = ref(false)
const busy = ref(false)
const nameField = useTemplateRef<InstanceType<typeof TextField>>('nameField')

const signOptions = computed<{ value: 'positive' | 'negative', label: string }[]>(() => [
  {
    value: 'positive',
    label: t('accountEdit.positive'),
  },
  {
    value: 'negative',
    label: t('accountEdit.negative'),
  },
])

async function load() {
  if (props.id) {
    const found = await getAccount(props.id)
    if (!found) {
      void router.replace(back)
      return
    }
    account.value = found
    name.value = accountName(found)
    icon.value = found.icon
    color.value = found.color
    balanceText.value = found.initialBalanceCents
      ? formatAmount(Math.abs(found.initialBalanceCents), intlLocale.value)
      : ''
    balanceSign.value = found.initialBalanceCents < 0
      ? 'negative'
      : 'positive'
    usage.value = await countAccountTransactions(found.id)
    ruleUsage.value = await countRecurrenceUses({ accountId: found.id })
  }
  others.value = (await listAccounts({ includeArchived: true })).filter(other => other.id !== props.id)
  if (!props.id) {
    const active = others.value.filter(other => !other.archived)
    icon.value = suggestAccountIcon(active)
    color.value = suggestColor(active)
  }
  ready.value = true
}
void load()

const title = computed(() => {
  if (!props.id)
    return t('accountEdit.new')
  return account.value
    ? accountName(account.value)
    : t('accountEdit.edit')
})

const cleanName = computed(() => name.value.trim().replace(/\s+/g, ' '))

const nameError = computed(() => {
  if (!cleanName.value) {
    return submitted.value
      ? t('accountEdit.nameRequired')
      : ''
  }
  const typed = normalizeText(cleanName.value)
  return others.value.some(other => normalizeText(accountName(other)) === typed)
    ? t('accountEdit.nameTaken')
    : ''
})

/** A default account keeps its translated name until the name changes. */
const nameHint = computed(() => {
  const preset = account.value?.preset
  return preset && !account.value?.name && cleanName.value === accountName({ preset })
    ? t('accountEdit.defaultName')
    : undefined
})

/** The initial balance on screen, with its sign; empty is zero, null is not an amount. */
const balanceCents = computed(() => {
  if (!balanceText.value.trim())
    return 0
  const cents = parseAmount(balanceText.value)
  if (cents === null)
    return null
  return balanceSign.value === 'negative'
    ? -cents
    : cents
})

const iconOptions = computed(() => ACCOUNT_ICONS.map(value => ({
  value,
  label: t(accountIconKey(value)),
})))

const isLastActive = computed(() => !!account.value && !account.value.archived && !others.value.some(other => !other.archived))
const deletable = computed(() => !!account.value && usage.value === 0 && ruleUsage.value === 0 && !isLastActive.value)

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
  const initialBalanceCents = balanceCents.value
  if (initialBalanceCents === null)
    return
  void run(async () => {
    const fields = {
      name: cleanName.value,
      icon: icon.value,
      color: color.value,
      initialBalanceCents,
    }
    if (!account.value) {
      const created = await createAccount(fields)
      showToast({
        message: t('accountEdit.added', {
          name: accountName(created),
        }),
      })
      return
    }
    await updateAccount(account.value.id, fields)
  })
}

/** The account the payment methods move to: the first active one left. */
function successorName(): string {
  const successor = others.value
    .filter(other => !other.archived)
    .sort((a, b) => a.order - b.order)[0]
  return successor
    ? accountName(successor)
    : ''
}

function archive() {
  const current = account.value
  if (!current)
    return
  void run(async () => {
    const methodIds = await archiveAccount(current.id)
    if (filter.accountId === current.id)
      filter.select(null)
    const values = {
      name: accountName(current),
      successor: successorName(),
    }
    showToast({
      message: methodIds.length
        ? t('accountEdit.archivedMovedToast', values)
        : t('accountEdit.archivedToast', values),
      action: {
        label: t('common.undo'),
        run: () => unarchiveAccount(current.id, { order: current.order, methodIds }),
      },
    })
  })
}

function unarchive() {
  const current = account.value
  if (!current)
    return
  void run(async () => {
    await unarchiveAccount(current.id)
    showToast({
      message: t('accountEdit.unarchivedToast', {
        name: accountName(current),
      }),
    })
  })
}

function remove() {
  const current = account.value
  if (!current)
    return
  void run(async () => {
    const methodIds = await deleteAccount(current.id)
    if (filter.accountId === current.id)
      filter.select(null)
    const values = {
      name: accountName(current),
      successor: successorName(),
    }
    showToast({
      message: methodIds.length
        ? t('accountEdit.deletedMovedToast', values)
        : t('accountEdit.deletedToast', values),
      action: {
        label: t('common.undo'),
        run: () => restoreAccount(current.id, methodIds),
      },
    })
  })
}

/** Movimenti on this account, archived too. */
function showTransactions() {
  if (!account.value)
    return
  filter.select(account.value.id)
  void router.push({ name: 'transactions' })
}
</script>

<template>
  <SubPage :title="title" :back="back">
    <template v-if="deletable" #actions>
      <IconButton icon="trash" tone="danger" :label="t('accountEdit.delete')" :disabled="busy" @click="remove" />
    </template>

    <template v-if="ready">
      <TextField
        ref="nameField"
        v-model="name"
        :label="t('accountEdit.name')"
        :hint="nameHint"
        :error="nameError"
        :maxlength="MAX_ACCOUNT_NAME"
        autocomplete="off"
        enterkeyhint="done"
        @keydown.enter.prevent="save"
      />

      <section class="account-edit__section" aria-labelledby="account-icon-title">
        <h2 id="account-icon-title" class="account-edit__title type-label">
          {{ t('accountEdit.icon') }}
        </h2>
        <IconPicker v-model="icon" :options="iconOptions" aria-labelledby="account-icon-title" />
      </section>

      <section class="account-edit__section" aria-labelledby="account-color-title">
        <div class="account-edit__heading">
          <h2 id="account-color-title" class="account-edit__title type-label">
            {{ t('accountEdit.color') }}
          </h2>
          <span class="type-note" aria-hidden="true">{{ t(colorNameKey(color)) }}</span>
        </div>
        <ColorPicker v-model="color" aria-labelledby="account-color-title" />
      </section>

      <div class="account-edit__balance">
        <TextField
          v-model="balanceText"
          class="account-edit__balance-field"
          :label="t('accountEdit.initialBalance')"
          inputmode="decimal"
          autocomplete="off"
          enterkeyhint="done"
          @keydown.enter.prevent="save"
        />
        <SegmentedControl v-model="balanceSign" :options="signOptions" :aria-label="t('accountEdit.balanceSign')" class="account-edit__sign" />
      </div>
      <p v-if="balanceCents === null" class="account-edit__note account-edit__note--error type-small" role="alert">
        {{ t('accountEdit.invalidBalance') }}
      </p>
      <p v-else class="account-edit__note type-small">
        {{ t('accountEdit.balanceHint') }}
      </p>

      <p v-if="account?.archived" class="account-edit__note type-small">
        {{ t('accountEdit.archivedNote') }}
      </p>
      <p v-else-if="isLastActive" class="account-edit__note type-small">
        {{ t('accountEdit.lastAccount') }}
      </p>
      <p v-if="usage > 0 && !account?.archived && !isLastActive" class="account-edit__note type-small">
        {{ t('accountEdit.usage', usage) }}
      </p>
      <p v-else-if="ruleUsage > 0 && !account?.archived && !isLastActive" class="account-edit__note type-small">
        {{ t('accountEdit.ruleUsage') }}
      </p>

      <button v-if="usage > 0" type="button" class="account-edit__link" @click="showTransactions">
        <AppIcon name="receipt" />
        <span class="type-body">{{ t('accountEdit.movements') }}</span>
        <AppIcon name="caret-right" class="account-edit__link-caret" />
      </button>
    </template>

    <template v-if="ready" #footer>
      <VvButton
        v-if="account?.archived"
        :label="t('accountEdit.unarchive')"
        modifiers="secondary"
        class="account-edit__action"
        :disabled="busy"
        @click="unarchive"
      >
        <template #before>
          <AppIcon name="arrow-counter-clockwise" class="account-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        v-else-if="account && !isLastActive"
        :label="t('accountEdit.archive')"
        modifiers="secondary"
        class="account-edit__action"
        :disabled="busy"
        @click="archive"
      >
        <template #before>
          <AppIcon name="archive" class="account-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        :label="t('accountEdit.save')"
        modifiers="primary"
        class="account-edit__action"
        :disabled="busy"
        @click="save"
      >
        <template #before>
          <AppIcon name="check" class="account-edit__action-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.account-edit__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.account-edit__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.account-edit__title {
  margin: 0;
}

.account-edit__balance {
  display: flex;
  align-items: flex-end;
  gap: 0.625rem;
  margin-top: 0.5rem;
}

.account-edit__balance-field {
  flex: 1;
  min-width: 0;
}

.account-edit__balance-field :deep(input) {
  font-family: var(--font-mono);
}

/* The two signs stay side by side: the field gives up the room. */
.account-edit__sign {
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.account-edit__sign :deep(.segmented-control__segment) {
  --vv-button-padding-inline: 0.625rem;

  flex-shrink: 0;
}

.account-edit__note {
  margin: 0;
  color: var(--color-ink-2);
}

.account-edit__note--error {
  color: var(--color-danger);
}

.account-edit__link {
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
  .account-edit__link:hover {
    background: var(--color-hover);
  }
}

.account-edit__link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.account-edit__link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .account-edit__link {
    transition: none;
  }
}

.account-edit__link .type-body {
  flex: 1;
}

.account-edit__link-caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}

.account-edit__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.account-edit__action-icon {
  --app-icon-size: 1.25rem;
}
</style>
