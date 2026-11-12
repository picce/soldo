<script setup lang="ts">
import type { RuleDraft } from './ImportRuleSheet.vue'
import type { ImportRule } from '@/db/schema'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import SubPage from '@/components/SubPage.vue'
import { categoryName } from '@/db/names'
import { listCategories } from '@/db/repositories/categories'
import { deleteImportRule, listImportRules, restoreImportRule, saveImportRule } from '@/db/repositories/import'
import { useLiveQuery } from '@/db/useLiveQuery'
import ImportRuleSheet from './ImportRuleSheet.vue'

/**
 * Category rules of the import (docs/specs/released/import-da-file.md, «Regole delle categorie»):
 * «the description contains X → category Y», by keyword. A tap opens the rule; «Nuova
 * regola» adds one. Deleting offers «Annulla».
 */
const { t } = useI18n()

const { data } = useLiveQuery(async () => {
  const [rules, categories] = await Promise.all([
    listImportRules(),
    listCategories({ includeArchived: true }),
  ])
  return { rules, categories }
})

const categoryById = computed(() => new Map((data.value?.categories ?? []).map(category => [category.id, category])))
const activeCategories = computed(() => (data.value?.categories ?? []).filter(category => !category.archived))

const editing = ref<ImportRule | null>(null)
const sheetOpen = ref(false)

function openRule(rule: ImportRule | null) {
  editing.value = rule
  sheetOpen.value = true
}

async function save(draft: RuleDraft) {
  await saveImportRule({
    ...draft,
    ...(editing.value
      ? { id: editing.value.id }
      : {}),
  })
}

async function remove(rule: ImportRule) {
  await deleteImportRule(rule.id)
  showToast({
    message: t('importRules.deleted'),
    action: {
      label: t('common.undo'),
      run: () => restoreImportRule(rule.id),
    },
  })
}
</script>

<template>
  <SubPage :title="t('importRules.title')" :back="{ name: 'settings' }">
    <template v-if="data">
      <div v-if="!data.rules.length" class="import-rules__empty">
        <AppIcon name="tag" class="import-rules__empty-icon" />
        <p class="type-body-strong">
          {{ t('importRules.emptyTitle') }}
        </p>
        <p class="import-rules__muted type-body">
          {{ t('importRules.empty') }}
        </p>
      </div>
      <ul v-else class="import-rules__card" :aria-label="t('importRules.title')">
        <li v-for="rule in data.rules" :key="rule.id">
          <button type="button" class="import-rules__row" @click="openRule(rule)">
            <AppIcon
              :name="categoryById.get(rule.categoryId)?.icon ?? 'tag'"
              class="import-rules__icon"
              :style="{ color: categoryById.get(rule.categoryId) ? `var(--color-category-${categoryById.get(rule.categoryId)!.color})` : undefined }"
            />
            <span class="import-rules__text">
              <span class="import-rules__pattern type-body">«{{ rule.pattern }}»</span>
              <span class="import-rules__muted type-small">
                {{ categoryById.get(rule.categoryId) ? categoryName(categoryById.get(rule.categoryId)!) : '' }} · {{ t(`importRules.${rule.kind}`) }}
              </span>
            </span>
            <AppIcon name="caret-right" class="import-rules__caret" />
          </button>
        </li>
      </ul>
    </template>
    <ImportRuleSheet v-model:open="sheetOpen" :rule="editing" :categories="activeCategories" @save="save" @delete="remove" />

    <template #footer>
      <VvButton :label="t('importRules.new')" modifiers="secondary" class="import-rules__new" @click="openRule(null)">
        <template #before>
          <AppIcon name="plus" weight="regular" class="import-rules__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.import-rules__muted {
  color: var(--color-ink-2);
}

.import-rules__card {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.import-rules__card > li + li {
  border-top: 1px solid var(--color-line);
}

.import-rules__row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  min-height: 3.75rem;
  padding: 0.5rem 0.875rem;
  border: 0;
  background: none;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .import-rules__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.import-rules__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.import-rules__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .import-rules__row {
    transition: none;
  }
}

.import-rules__icon {
  --app-icon-size: 1.5rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.import-rules__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.import-rules__pattern {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-rules__caret {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.import-rules__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}

.import-rules__empty p {
  margin: 0;
}

.import-rules__empty-icon {
  --app-icon-size: 2.5rem;

  color: var(--color-ink-2);
}

.import-rules__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.import-rules__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
