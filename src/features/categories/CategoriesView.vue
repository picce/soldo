<script setup lang="ts">
import type { CategoryKind } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ArchivedSection from '@/components/ArchivedSection.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SortableList from '@/components/SortableList.vue'
import SubPage from '@/components/SubPage.vue'
import { categoryName } from '@/db/names'
import { listCategories, reorderCategories } from '@/db/repositories/categories'
import { useLiveQuery } from '@/db/useLiveQuery'
import CategoryLink from './CategoryLink.vue'

/**
 * Categories of expenses and income (docs/specs/released/gestione-categorie.md): the order here is
 * the order of the quick-add grid. Rows move with the handle, or with «Sposta su» and
 * «Sposta giù», which appear when reached with the keyboard. Archived categories wait in
 * a closed section at the end.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// The kind lives in the URL (?tipo=entrate), so Indietro from a category comes back to it.
const kind = computed<CategoryKind>({
  get: () => route.query.tipo === 'entrate'
    ? 'income'
    : 'expense',
  set: (value) => {
    void router.replace({
      query: {
        ...route.query,
        tipo: value === 'income'
          ? 'entrate'
          : undefined,
      },
    })
  },
})

const kindOptions = computed<{ value: CategoryKind, label: string }[]>(() => [
  {
    value: 'expense',
    label: t('categories.expenses'),
  },
  {
    value: 'income',
    label: t('categories.income'),
  },
])

const { data: rows } = useLiveQuery(() => listCategories({ kind: kind.value, includeArchived: true }), [kind])
const active = computed(() => rows.value?.filter(category => !category.archived))
const archived = computed(() => (rows.value ?? []).filter(category => category.archived))

const newCategory = computed(() => ({
  name: 'category-edit',
  params: { id: 'nuova' },
  query: kind.value === 'income'
    ? { tipo: 'entrate' }
    : {},
}))
</script>

<template>
  <SubPage :title="t('categories.title')" :back="{ name: 'settings' }">
    <SegmentedControl v-model="kind" :options="kindOptions" :aria-label="t('categories.kind')" class="categories__kind" />

    <SortableList
      :source="active"
      :persist="reorderCategories"
      :name-of="categoryName"
      class="categories__list"
      :aria-label="kind === 'income' ? t('categories.listIncome') : t('categories.listExpense')"
    >
      <template #row="{ item }">
        <CategoryLink :category="item" />
      </template>
    </SortableList>
    <p v-if="active && !active.length" class="categories__empty type-small">
      {{ t('categories.empty') }}
    </p>

    <ArchivedSection v-if="archived.length" :label="t('categories.archived', { count: archived.length })">
      <ul class="categories__list categories__list--archived">
        <li v-for="category in archived" :key="category.id" class="category-row">
          <CategoryLink :category="category" />
        </li>
      </ul>
    </ArchivedSection>

    <template #footer>
      <VvButton :to="newCategory" :label="t('categories.new')" modifiers="secondary" class="categories__new">
        <template #before>
          <AppIcon name="plus" weight="regular" class="categories__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.categories__kind {
  align-self: flex-start;
}

.categories__list--archived {
  margin: 0.75rem 0 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.category-row {
  display: flex;
}

.category-row + .category-row {
  border-top: 1px solid var(--color-line);
}

.categories__list--archived :deep(.category-link) {
  padding-inline-start: 1rem;
}

.categories__empty {
  margin: 0;
  color: var(--color-ink-2);
}

.categories__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.categories__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
