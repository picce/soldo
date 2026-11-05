<script setup lang="ts">
import type { Category } from '@/db/schema'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { categoryName } from '@/db/names'

/**
 * Category filter of Movimenti (mockup "Filtro categoria"). The choice applies with
 * «Applica»; «Azzera» removes the filter. No category ticked means all of them.
 */
const props = defineProps<{
  categories: Category[]
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
    draft.value = props.selected.filter(id => props.categories.some(category => category.id === id))
})

const allChecked = computed(() => draft.value.length === 0)

function toggle(id: string) {
  draft.value = draft.value.includes(id)
    ? draft.value.filter(item => item !== id)
    : [...draft.value, id]
}

/** «Tutte le categorie» cannot be unticked by itself: it is ticked by clearing the others. */
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
  <BottomSheet v-model="open" :title="t('categoryFilter.title')">
    <label class="category-filter__all">
      <input
        type="checkbox"
        class="category-filter__input"
        :checked="allChecked"
        @change="selectAll"
      >
      <span class="category-filter__box" aria-hidden="true">
        <AppIcon v-if="allChecked" name="check" weight="regular" />
      </span>
      <span class="type-body-strong">{{ t('categoryFilter.all') }}</span>
    </label>
    <ul class="category-filter__list">
      <li v-for="category in categories" :key="category.id">
        <label class="category-filter__row">
          <input
            type="checkbox"
            class="category-filter__input"
            :checked="draft.includes(category.id)"
            @change="toggle(category.id)"
          >
          <span class="category-filter__box" aria-hidden="true">
            <AppIcon v-if="draft.includes(category.id)" name="check" weight="regular" />
          </span>
          <AppIcon
            :name="category.icon"
            class="category-filter__icon"
            :style="{ color: `var(--color-category-${category.color})` }"
          />
          <span class="type-body">{{ categoryName(category) }}</span>
        </label>
      </li>
    </ul>
    <template #footer>
      <VvButton :label="t('categoryFilter.reset')" modifiers="secondary" class="category-filter__button" @click="apply([])" />
      <VvButton
        :label="draft.length ? t('categoryFilter.applyCount', { count: draft.length }) : t('categoryFilter.apply')"
        modifiers="primary"
        class="category-filter__button"
        @click="apply(draft)"
      />
    </template>
  </BottomSheet>
</template>

<style scoped>
.category-filter__all,
.category-filter__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-height: 2.75rem;
  cursor: pointer;
}

.category-filter__all {
  margin-bottom: 0.75rem;
}

.category-filter__list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.category-filter__list li + li {
  border-top: 1px solid var(--color-line);
}

.category-filter__row {
  padding: 0.25rem 1rem;
}

/* The real checkbox stays in the page for keyboard and screen readers; the box draws it. */
.category-filter__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.category-filter__box {
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

.category-filter__input:checked + .category-filter__box {
  background: var(--color-pen);
  border-color: var(--color-pen);
}

.category-filter__input:focus-visible + .category-filter__box {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.category-filter__box .app-icon {
  --app-icon-size: 1rem;
}

.category-filter__icon {
  --app-icon-size: 1.375rem;
}

.category-filter__button {
  flex: 1;
  min-height: 3.25rem;
}
</style>
