<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'

export interface FilterItem {
  id: string
  label: string
  icon: string
  /** Palette color of the icon, 1 to 8; without it the icon follows the text. */
  color?: number
}

/**
 * A filter of Movimenti with many choices: categories (mockup "Filtro categoria") and payment
 * methods. The choice applies with «Applica»; «Azzera» removes the filter. Nothing ticked means
 * all of them.
 */
const props = defineProps<{
  title: string
  allLabel: string
  items: FilterItem[]
  selected: string[]
}>()

const emit = defineEmits<{
  apply: [ids: string[]]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const draft = ref<string[]>([])

watch(open, (isOpen) => {
  if (isOpen)
    draft.value = props.selected.filter(id => props.items.some(item => item.id === id))
})

const allChecked = computed(() => draft.value.length === 0)

function toggle(id: string) {
  draft.value = draft.value.includes(id)
    ? draft.value.filter(item => item !== id)
    : [...draft.value, id]
}

/** «Tutte» cannot be unticked by itself: it is ticked by clearing the others. */
function selectAll(event: Event) {
  draft.value = []
  ;(event.target as HTMLInputElement).checked = true
}

function apply(ids: string[]) {
  emit('apply', ids)
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="title">
    <label class="filter-sheet__all">
      <input
        type="checkbox"
        class="filter-sheet__input"
        :checked="allChecked"
        @change="selectAll"
      >
      <span class="filter-sheet__box" aria-hidden="true">
        <AppIcon v-if="allChecked" name="check" weight="regular" />
      </span>
      <span class="type-body-strong">{{ allLabel }}</span>
    </label>
    <ul class="filter-sheet__list">
      <li v-for="item in items" :key="item.id">
        <label class="filter-sheet__row">
          <input
            type="checkbox"
            class="filter-sheet__input"
            :checked="draft.includes(item.id)"
            @change="toggle(item.id)"
          >
          <span class="filter-sheet__box" aria-hidden="true">
            <AppIcon v-if="draft.includes(item.id)" name="check" weight="regular" />
          </span>
          <AppIcon
            :name="item.icon"
            class="filter-sheet__icon"
            :style="item.color ? { color: `var(--color-category-${item.color})` } : undefined"
          />
          <span class="type-body">{{ item.label }}</span>
        </label>
      </li>
    </ul>
    <template #footer>
      <VvButton :label="t('filterSheet.reset')" modifiers="secondary" class="filter-sheet__button" @click="apply([])" />
      <VvButton
        :label="draft.length ? t('filterSheet.applyCount', { count: draft.length }) : t('filterSheet.apply')"
        modifiers="primary"
        class="filter-sheet__button"
        @click="apply(draft)"
      />
    </template>
  </BottomSheet>
</template>

<style scoped>
.filter-sheet__all,
.filter-sheet__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 2.75rem;
  cursor: pointer;
}

.filter-sheet__all {
  margin-bottom: 0.75rem;
}

.filter-sheet__list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.filter-sheet__list li + li {
  border-top: 1px solid var(--color-line);
}

.filter-sheet__row {
  padding: 0.25rem 1rem;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .filter-sheet__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.filter-sheet__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

/* The real checkbox stays in the page for keyboard and screen readers; the box draws it. */
.filter-sheet__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.filter-sheet__box {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink-2);
  border-radius: 4px;
  color: var(--color-on-pen);
}

.filter-sheet__input:checked + .filter-sheet__box {
  background: var(--color-pen);
  border-color: var(--color-pen);
}

.filter-sheet__input:focus-visible + .filter-sheet__box {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.filter-sheet__box .app-icon {
  --app-icon-size: 1rem;
}

.filter-sheet__icon {
  --app-icon-size: 1.375rem;
}

.filter-sheet__button {
  flex: 1;
  min-height: 3.25rem;
}
</style>
