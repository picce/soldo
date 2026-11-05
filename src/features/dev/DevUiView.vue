<script setup lang="ts">
import type { Category, CategoryPreset, PaletteColor } from '@/db/schema'
import type { Period } from '@/domain/periods'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import ActionChip from '@/components/ActionChip.vue'
import AmountText from '@/components/AmountText.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryBar from '@/components/CategoryBar.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import Keypad from '@/components/Keypad.vue'
import PeriodSwitcher from '@/components/PeriodSwitcher.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { shiftPeriod } from '@/domain/periods'

/**
 * Internal page, registered only in development (/dev/ui): every app component, in the
 * light theme and in a dark box, to check them side by side. Headings are component
 * names, not interface copy. A spec that adds a component adds it here.
 */
const { t } = useI18n()

const THEMES = ['light', 'dark'] as const

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

const kind = ref<'expense' | 'income'>('expense')
const lastKey = ref('')
const sheetOpen = ref(false)
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
    </section>

    <BottomSheet v-model="sheetOpen" :title="t('noteSheet.title')">
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

.dev-ui__spaced {
  margin-top: 0.75rem;
}
</style>
