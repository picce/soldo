<script setup lang="ts">
import type { PreviewRow } from './preview'
import type { Category } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'
import { categoryName } from '@/db/names'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'

/**
 * A row of the import preview (docs/specs/import-da-file.md): like a transaction of Movimenti,
 * the description of the bank and the category below; a row left out is dimmed, one that
 * merges says with what. A tap opens its sheet.
 */
const props = defineProps<{
  item: PreviewRow
  category?: Category
}>()

defineEmits<{
  open: []
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()

const merging = computed(() => !!props.item.duplicateOf && props.item.merge)
const detail = computed(() => {
  if (!props.item.include)
    return t('import.preview.excluded')
  const duplicate = props.item.duplicateOf
  if (duplicate && props.item.merge) {
    return t('import.preview.merged', {
      what: duplicate.note || formatAmount(duplicate.amountCents, intlLocale.value, { currency: true }),
    })
  }
  return props.category
    ? categoryName(props.category)
    : ''
})
</script>

<template>
  <button
    type="button"
    class="import-row"
    :class="{ 'import-row--excluded': !item.include }"
    @click="$emit('open')"
  >
    <AppIcon
      :name="merging ? 'git-merge' : category?.icon ?? 'receipt'"
      class="import-row__icon"
      :style="{ color: category && !merging ? `var(--color-category-${category.color})` : undefined }"
    />
    <span class="import-row__text">
      <span class="import-row__title type-body">{{ item.row.description || detail }}</span>
      <span class="import-row__detail type-small">{{ detail }}</span>
    </span>
    <AmountText :cents="item.row.amountCents" :sign="item.row.amountCents > 0 ? 'always' : 'auto'" :colored="item.include" />
  </button>
</template>

<style scoped>
.import-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  min-height: 3.75rem;
  padding: 0.5rem 1rem;
  border: 0;
  background: none;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .import-row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.import-row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.import-row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .import-row {
    transition: none;
  }
}

.import-row__icon {
  --app-icon-size: 1.375rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.import-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.import-row__title,
.import-row__detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-row__detail {
  color: var(--color-ink-2);
}

/* Left out: still there, so it can come back, but quiet. */
.import-row--excluded .import-row__title,
.import-row--excluded :deep(.amount-text) {
  color: var(--color-ink-2);
  text-decoration: line-through;
}
</style>
