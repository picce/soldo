<script setup lang="ts">
import type { Account, Category, CategoryPreset, PaletteColor, PaymentMethod } from '@/db/schema'
import type { Period } from '@/domain/periods'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import QuickAddButton from '@/app/components/QuickAddButton.vue'
import RotateNotice from '@/app/components/RotateNotice.vue'
import { showToast } from '@/app/toast'
import ActionChip from '@/components/ActionChip.vue'
import AmountText from '@/components/AmountText.vue'
import ArchivedSection from '@/components/ArchivedSection.vue'
import BarChart from '@/components/BarChart.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import BudgetMeter from '@/components/BudgetMeter.vue'
import CategoryBar from '@/components/CategoryBar.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import FilterChip from '@/components/FilterChip.vue'
import IconButton from '@/components/IconButton.vue'
import IconPicker from '@/components/IconPicker.vue'
import Keypad from '@/components/Keypad.vue'
import LineChart from '@/components/LineChart.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import PinDots from '@/components/PinDots.vue'
import PinPad from '@/components/PinPad.vue'
import SearchField from '@/components/SearchField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortableList from '@/components/SortableList.vue'
import SwipeRow from '@/components/SwipeRow.vue'
import TextField from '@/components/TextField.vue'
import { shiftPeriod } from '@/domain/periods'
import AccountSelector from '@/features/accounts/AccountSelector.vue'
import AccountSheet from '@/features/accounts/AccountSheet.vue'
import BudgetFlag from '@/features/budgets/BudgetFlag.vue'
import { CATEGORY_ICONS, iconNameKey } from '@/features/categories/icons'
import PaymentMethodSheet from '@/features/payments/PaymentMethodSheet.vue'
import EncryptionSheet from '@/features/settings/EncryptionSheet.vue'
import LockSheet from '@/features/settings/LockSheet.vue'
import NoteField from '@/features/transactions/NoteField.vue'

/**
 * Internal page, registered only in development (/dev/ui): every app component, in the
 * light theme and in a dark box, to check them side by side. Headings are component
 * names, not interface copy. A spec that adds a component adds it here.
 */
const { t } = useI18n()

const THEMES = ['light', 'dark'] as const

// Charts of the Statistics, with made-up figures.
const chartDays = Array.from({ length: 30 }, (_, index) => index)
const chartLines = [
  {
    key: 'now',
    label: 'novembre',
    values: [
      1240,
      5820,
      9680,
      12030,
      19860,
      25100,
      31240,
    ],
    color: 'var(--color-chart-expense)',
  },
  {
    key: 'before',
    label: 'ottobre',
    values: chartDays.map(day => 4200 * (day + 1)),
    color: 'var(--color-ink-2)',
    dashed: true,
  },
]
const chartBars = [
  {
    key: 'income',
    label: 'Entrate',
    values: [
      185000,
      185000,
      185000,
      320000,
      185000,
      0,
    ],
    color: 'var(--color-chart-income)',
  },
  {
    key: 'expense',
    label: 'Uscite',
    values: [
      118000,
      102000,
      124000,
      162000,
      126430,
      0,
    ],
    color: 'var(--color-chart-expense)',
  },
]
const chartEuros = (cents: number) => `${Math.round(cents / 100)} €`

function sampleCategory(preset: CategoryPreset, icon: string, color: PaletteColor, order: number): Category {
  return {
    id: preset,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    kind: 'expense',
    preset,
    icon,
    color,
    order,
    archived: false,
  }
}

const categories: Category[] = [
  sampleCategory('groceries', 'shopping-cart', 1, 0),
  sampleCategory('home', 'house', 2, 1),
  sampleCategory('restaurants', 'fork-knife', 3, 2),
  sampleCategory('transport', 'bus', 4, 3),
  sampleCategory('leisure', 'popcorn', 5, 4),
  sampleCategory('other', 'dots-three-outline', 6, 5),
  sampleCategory('bills', 'lightning', 7, 6),
  sampleCategory('health', 'first-aid', 8, 7),
]

const accounts: Account[] = [
  {
    id: 'cash',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    preset: 'cash',
    type: 'cash',
    icon: 'wallet',
    color: 1,
    initialBalanceCents: 0,
    currency: 'EUR',
    archived: false,
    order: 0,
  },
  {
    id: 'bank',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    name: 'Banca',
    type: 'bank',
    icon: 'bank',
    color: 7,
    initialBalanceCents: 0,
    currency: 'EUR',
    archived: false,
    order: 1,
  },
]
const paymentMethods: PaymentMethod[] = [
  {
    id: 'card',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    preset: 'card',
    icon: 'credit-card',
    accountId: 'bank',
    order: 0,
    archived: false,
  },
  {
    id: 'cash',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    preset: 'cash',
    icon: 'wallet',
    accountId: 'cash',
    order: 1,
    archived: false,
  },
]
const choices = [
  {
    id: 'all',
    title: t('accountSelector.all'),
    icon: 'wallet',
    cents: 246170,
    strong: true,
  },
  {
    id: 'bank',
    title: 'Banca',
    icon: 'bank',
    color: 7,
    detail: t('accounts.default'),
    cents: 234120,
  },
]
const pickedChoice = ref('all')
const accountSheetOpen = ref(false)
const paymentSheetOpen = ref(false)
const encryptionSheetOpen = ref(false)
const lockSheetOpen = ref(false)
const typedPin = ref('')
const devNote = ref('')

const kind = ref<'expense' | 'income'>('expense')
const lastKey = ref('')
const search = ref('')
const lastSwipe = ref('')
const sheetOpen = ref(false)
const fieldText = ref('')
const pickedIcon = ref('shopping-cart')
const pickedColor = ref<PaletteColor>(1)
const iconOptions = CATEGORY_ICONS.slice(0, 12).map(value => ({
  value,
  label: t(iconNameKey(value)),
}))
const period = ref<Period>({ unit: 'month', anchor: '2026-11-05' })
const segments = categories.slice(0, 6).map((category, index) => ({
  key: category.id,
  color: `var(--color-category-${category.color})`,
  share: [0.32, 0.27, 0.15, 0.11, 0.08, 0.07][index] ?? 0,
}))

function toast() {
  showToast({
    message: t('toast.deleted', {
      amount: '−1,80 €',
      category: t('presets.categories.restaurants'),
    }),
    action: {
      label: t('common.undo'),
      run: () => {},
    },
  })
}
</script>

<template>
  <div class="dev-ui">
    <h1 class="type-title">
      /dev/ui
    </h1>
    <section
      v-for="theme in THEMES"
      :key="theme"
      class="dev-ui__panel theme"
      :class="`theme--${theme}`"
    >
      <h2 class="type-label">
        {{ theme }}
      </h2>

      <h3 class="dev-ui__name type-note">
        SegmentedControl
      </h3>
      <SegmentedControl
        v-model="kind"
        :options="[{ value: 'expense', label: t('editor.expense') }, { value: 'income', label: t('editor.income') }]"
        aria-label="SegmentedControl"
      />

      <h3 class="dev-ui__name type-note">
        AmountText
      </h3>
      <p class="dev-ui__row">
        <AmountText :cents="-1240" />
        <AmountText :cents="245000" sign="always" colored />
        <AmountText :cents="-128430" currency />
      </p>

      <h3 class="dev-ui__name type-note">
        ActionChip
      </h3>
      <p class="dev-ui__row">
        <ActionChip icon="calendar-blank" :label="t('dateSheet.today')" />
        <ActionChip icon="wallet" :label="t('presets.accounts.cash')" />
        <ActionChip icon="note-pencil" :label="t('editor.note')" />
      </p>

      <h3 class="dev-ui__name type-note">
        VvButton
      </h3>
      <p class="dev-ui__row">
        <VvButton :label="t('editor.duplicate')" modifiers="secondary" />
        <VvButton :label="t('editor.save')" modifiers="primary" />
        <VvButton :label="t('dateSheet.confirm')" modifiers="primary" disabled />
      </p>

      <h3 class="dev-ui__name type-note">
        IconButton
      </h3>
      <p class="dev-ui__row">
        <IconButton icon="caret-left" :label="t('common.back')" />
        <IconButton icon="x" :label="t('common.close')" />
        <IconButton icon="trash" tone="danger" :label="t('editor.delete')" />
      </p>

      <h3 class="dev-ui__name type-note">
        TextField
      </h3>
      <TextField v-model="fieldText" :label="t('categoryEdit.name')" :hint="t('categoryEdit.defaultName')" :maxlength="24" />
      <TextField v-model="fieldText" :label="t('categoryEdit.name')" :error="t('categoryEdit.nameRequired')" />

      <h3 class="dev-ui__name type-note">
        IconPicker
      </h3>
      <IconPicker v-model="pickedIcon" :options="iconOptions" aria-label="IconPicker" />

      <h3 class="dev-ui__name type-note">
        ColorPicker
      </h3>
      <ColorPicker v-model="pickedColor" aria-label="ColorPicker" />

      <h3 class="dev-ui__name type-note">
        SortableList
      </h3>
      <SortableList :source="accounts" :persist="async () => {}" :name-of="account => account.id" aria-label="SortableList">
        <template #row="{ item }">
          <span class="type-body">{{ item.id }}</span>
        </template>
      </SortableList>

      <h3 class="dev-ui__name type-note">
        BudgetMeter and BudgetFlag: below 80%, from 80%, over the budget
      </h3>
      <h3 class="dev-ui__name type-note">
        LineChart, BarChart
      </h3>
      <LineChart
        label="LineChart"
        :series="chartLines"
        :length="30"
        :ticks="[0, 7, 14, 21, 29]"
        :tick-label="index => String(index + 1)"
        :point-label="index => `${index + 1} nov`"
        :format-value="chartEuros"
        :format-tick="chartEuros"
        :marker="6"
      />
      <BarChart
        label="BarChart"
        :series="chartBars"
        :labels="['G', 'F', 'M', 'A', 'M', 'G']"
        :point-label="index => String(index + 1)"
        :format-value="chartEuros"
        :format-tick="chartEuros"
        :average="140000"
        average-label="media"
        :emphasis="4"
        class="dev-ui__spaced"
      />

      <div v-for="spent in [4000, 8600, 12100]" :key="spent" class="dev-ui__meter">
        <BudgetMeter :spent-cents="spent" :budget-cents="10000" :label="t('budgets.total')" />
        <BudgetFlag :spent-cents="spent" :budget-cents="10000" class="type-small" />
      </div>

      <h3 class="dev-ui__name type-note">
        ArchivedSection
      </h3>
      <ArchivedSection :label="t('accounts.archived', { count: 1 })">
        <p class="type-small">
          {{ t('accountEdit.archivedNote') }}
        </p>
      </ArchivedSection>

      <h3 class="dev-ui__name type-note">
        ChoiceList
      </h3>
      <ChoiceList :choices="choices" :selected="pickedChoice" aria-label="ChoiceList" @select="pickedChoice = $event" />

      <h3 class="dev-ui__name type-note">
        AccountSelector (from the database, with at least two accounts), AccountSheet, PaymentMethodSheet
      </h3>
      <p>
        <AccountSelector />
        <ActionChip icon="wallet" :label="t('accountSheet.title')" @click="accountSheetOpen = true" />
        <ActionChip icon="credit-card" :label="t('paymentSheet.title')" @click="paymentSheetOpen = true" />
      </p>
      <AccountSheet v-model:open="accountSheetOpen" :accounts="accounts" selected="bank" />
      <PaymentMethodSheet v-model:open="paymentSheetOpen" :methods="paymentMethods" :accounts="accounts" selected="card" />

      <h3 class="dev-ui__name type-note">
        EncryptionSheet (the real setting of this device)
      </h3>
      <p>
        <ActionChip icon="lock" :label="t('encryption.title')" @click="encryptionSheetOpen = true" />
      </p>
      <EncryptionSheet v-model:open="encryptionSheetOpen" />

      <h3 class="dev-ui__name type-note">
        PinDots, PinPad, LockSheet (the real setting of this device)
      </h3>
      <PinDots :filled="typedPin.length" :total="4" />
      <PinPad @digit="typedPin = (typedPin + $event).slice(-4)" @delete="typedPin = typedPin.slice(0, -1)" />
      <p>
        <ActionChip icon="lock-key" :label="t('lockSheet.title')" @click="lockSheetOpen = true" />
      </p>
      <LockSheet v-model:open="lockSheetOpen" />

      <h3 class="dev-ui__name type-note">
        SearchField
      </h3>
      <SearchField v-model="search" :placeholder="t('transactions.search')" />

      <h3 class="dev-ui__name type-note">
        FilterChip
      </h3>
      <p class="dev-ui__row">
        <FilterChip :label="t('transactions.all')" pressed />
        <FilterChip :label="t('transactions.expenses')" />
        <FilterChip :label="t('transactions.category')" icon="caret-down" />
      </p>

      <h3 class="dev-ui__name type-note">
        SwipeRow {{ lastSwipe }}
      </h3>
      <SwipeRow
        class="dev-ui__swipe"
        :left-action="{ label: t('transactions.swipeDelete'), icon: 'trash', tone: 'danger' }"
        :right-action="{ label: t('transactions.swipeDuplicate'), icon: 'copy', tone: 'pen' }"
        @swipe="lastSwipe = $event"
      >
        <p class="dev-ui__swipe-content type-body">
          {{ t('transactions.swipeDelete') }} ← → {{ t('transactions.swipeDuplicate') }}
        </p>
      </SwipeRow>

      <h3 class="dev-ui__name type-note">
        PeriodSwitcher
      </h3>
      <PeriodSwitcher
        :period="period"
        @update:unit="period = { unit: $event, anchor: period.anchor }"
        @shift="period = shiftPeriod(period, $event)"
      />

      <h3 class="dev-ui__name type-note">
        CategoryBar
      </h3>
      <CategoryBar :segments="segments" label="CategoryBar" />
      <CategoryBar :segments="[]" label="CategoryBar" />

      <h3 class="dev-ui__name type-note">
        CategoryGrid
      </h3>
      <CategoryGrid :categories="categories" />
      <CategoryGrid :categories="categories.slice(0, 4)" selectable selected-id="groceries" class="dev-ui__spaced" />

      <h3 class="dev-ui__name type-note">
        Keypad {{ lastKey }}
      </h3>
      <Keypad @press="lastKey = $event" />

      <h3 class="dev-ui__name type-note">
        AppToast, BottomSheet
      </h3>
      <p class="dev-ui__row">
        <VvButton label="AppToast" modifiers="secondary" @click="toast" />
        <VvButton label="BottomSheet" modifiers="secondary" @click="sheetOpen = true" />
      </p>

      <h3 class="dev-ui__name type-note">
        NoteField (frequent notes from the database)
      </h3>
      <div class="dev-ui__note">
        <NoteField v-model:note="devNote" kind="expense" />
      </div>

      <h3 class="dev-ui__name type-note">
        QuickAddButton (fixed above the navigation: here in a box)
      </h3>
      <div class="dev-ui__quick-add">
        <QuickAddButton />
      </div>

      <h3 class="dev-ui__name type-note">
        RotateNotice
      </h3>
      <RotateNotice preview />
    </section>

    <BottomSheet v-model="sheetOpen" :title="t('editor.note')">
      <p class="type-body">
        BottomSheet
      </p>
    </BottomSheet>
  </div>
</template>

<style scoped>
.dev-ui {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dev-ui h1,
.dev-ui h2 {
  margin: 0;
}

.dev-ui__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
}

.dev-ui__name {
  margin: 0.75rem 0 0;
}

.dev-ui__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.dev-ui__swipe {
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.dev-ui__swipe-content {
  margin: 0;
  padding: 1rem;
}

.dev-ui__spaced {
  margin-top: 0.75rem;
}
.dev-ui__meter {
  display: grid;
  grid-template-columns: 1fr 3rem;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

/* Room below for the frequent notes, which open over what follows. */
.dev-ui__note {
  display: flex;
  min-height: 6rem;
}

/* The button is fixed to the page: a box with a transform keeps it inside. */
.dev-ui__quick-add {
  position: relative;
  height: 5rem;
  transform: translate(0);
}
</style>
