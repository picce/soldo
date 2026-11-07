<script setup lang="ts">
import type { Budget, Category } from '@/db/schema'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { goBack } from '@/app/navigation'
import { showToast } from '@/app/toast'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SubPage from '@/components/SubPage.vue'
import TextField from '@/components/TextField.vue'
import { categoryName } from '@/db/names'
import { getBudgetInForce, removeBudget, restoreBudgets, setBudget } from '@/db/repositories/budgets'
import { getCategory } from '@/db/repositories/categories'
import { listTransactions } from '@/db/repositories/transactions'
import { isMonth, monthOf, monthRange, monthSpending, spentFor } from '@/domain/budgets'
import { formatDate, today } from '@/domain/dates'
import { formatAmount, parseAmount } from '@/domain/money'
import { periodLabel } from '@/domain/periods'
import { useIntlLocale } from '@/i18n/locale'

/**
 * The budget of a month, total or of a category (docs/specs/budget-mensili.md, mockup "Un
 * budget"): it repeats from this month on, or holds for this month only. «Togli» takes it away
 * from this month on, with «Annulla».
 */
const props = defineProps<{
  /** A category id, or `totale`. */
  categoryKey: string
  /** `YYYY-MM`; any other value is the current month. */
  month?: string
}>()

type When = 'repeat' | 'once'

const { t } = useI18n()
const router = useRouter()
const intlLocale = useIntlLocale()

const key = props.categoryKey === 'totale'
  ? null
  : props.categoryKey
const month = isMonth(props.month)
  ? props.month
  : monthOf(today())
const back = {
  name: 'budget',
  query: { mese: month },
}

const category = shallowRef<Category>()
const current = shallowRef<Budget>()
const spentCents = ref(0)
const ready = ref(false)
const amountText = ref('')
const when = ref<When>('repeat')
const submitted = ref(false)
const busy = ref(false)
const amountField = useTemplateRef<InstanceType<typeof TextField>>('amountField')

const monthLabel = computed(() => periodLabel({ unit: 'month', anchor: `${month}-01` }, intlLocale.value))
const monthName = computed(() => formatDate(`${month}-01`, intlLocale.value, { month: 'long' }))
/** Month and year inside a sentence: «da marzo 2026», not the title-case label. */
const monthInText = computed(() => formatDate(`${month}-01`, intlLocale.value, { month: 'long', year: 'numeric' }))

async function load() {
  if (key) {
    category.value = await getCategory(key)
    if (!category.value) {
      void router.replace(back)
      return
    }
  }
  const [budget, transactions] = await Promise.all([
    getBudgetInForce(month, key),
    listTransactions(monthRange(month)),
  ])
  current.value = budget
  spentCents.value = spentFor(monthSpending(transactions, month), key)
  if (budget) {
    amountText.value = formatAmount(budget.amountCents, intlLocale.value)
    when.value = budget.month === month && !budget.repeat
      ? 'once'
      : 'repeat'
  }
  ready.value = true
}
void load()

const title = computed(() => category.value
  ? t('budgetEdit.categoryTitle', {
      name: categoryName(category.value),
    })
  : t('budgetEdit.totalTitle'))

const whenOptions = computed<{ value: When, label: string }[]>(() => [
  {
    value: 'repeat',
    label: t('budgetEdit.repeat'),
  },
  {
    value: 'once',
    label: t('budgetEdit.once', { month: monthName.value }),
  },
])

const amountCents = computed(() => parseAmount(amountText.value))
const amountError = computed(() => submitted.value && !amountCents.value
  ? t('budgetEdit.invalidAmount')
  : '')

/** Runs one change at a time, then goes back to the month; on failure it stays here. */
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
  const cents = amountCents.value
  if (!cents) {
    amountField.value?.focus()
    return
  }
  void run(async () => {
    await setBudget({
      month,
      categoryId: key,
      amountCents: cents,
      repeat: when.value === 'repeat',
    })
  })
}

function remove() {
  void run(async () => {
    const previous = await removeBudget(month, key)
    showToast({
      message: category.value
        ? t('budgetEdit.removedCategory', {
            name: categoryName(category.value),
            month: monthName.value,
          })
        : t('budgetEdit.removedTotal', { month: monthName.value }),
      action: {
        label: t('common.undo'),
        run: () => restoreBudgets(previous),
      },
    })
  })
}
</script>

<template>
  <SubPage :title="title" :back="back">
    <template v-if="ready">
      <p class="budget-edit__month type-note">
        {{ monthLabel }}
      </p>

      <TextField
        ref="amountField"
        v-model="amountText"
        class="budget-edit__amount"
        :label="t('budgetEdit.amount')"
        :error="amountError"
        inputmode="decimal"
        autocomplete="off"
        enterkeyhint="done"
        @keydown.enter.prevent="save"
      />

      <SegmentedControl v-model="when" :options="whenOptions" :aria-label="t('budgetEdit.when')" class="budget-edit__when" />
      <p class="budget-edit__note type-small">
        {{ when === 'repeat' ? t('budgetEdit.repeatHint', { month: monthInText }) : t('budgetEdit.onceHint', { month: monthInText }) }}
      </p>

      <div class="budget-edit__spent">
        <AppIcon name="receipt" class="budget-edit__spent-icon" />
        <span class="type-body">{{ t('budgetEdit.spent', { month: monthName }) }}</span>
        <AmountText :cents="spentCents" currency />
      </div>
    </template>

    <template v-if="ready" #footer>
      <VvButton
        v-if="current"
        :label="t('budgetEdit.remove')"
        modifiers="secondary"
        class="budget-edit__action"
        :disabled="busy"
        @click="remove"
      >
        <template #before>
          <AppIcon name="x" class="budget-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        :label="t('budgetEdit.save')"
        modifiers="primary"
        class="budget-edit__action"
        :disabled="busy"
        @click="save"
      >
        <template #before>
          <AppIcon name="check" class="budget-edit__action-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.budget-edit__month {
  margin: -0.5rem 0 0;
  color: var(--color-ink-2);
}

.budget-edit__amount :deep(input) {
  font-family: var(--font-mono);
}

.budget-edit__when {
  align-self: flex-start;
}

.budget-edit__note {
  margin: 0;
  color: var(--color-ink-2);
}

.budget-edit__spent {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.budget-edit__spent .type-body {
  flex: 1;
}

.budget-edit__spent-icon {
  --app-icon-size: 1.375rem;

  color: var(--color-ink-2);
}

.budget-edit__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.budget-edit__action-icon {
  --app-icon-size: 1.25rem;
}
</style>
