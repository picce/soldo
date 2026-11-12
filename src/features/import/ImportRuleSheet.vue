<script setup lang="ts">
import type { Category, ImportRule } from '@/db/schema'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TextField from '@/components/TextField.vue'
import { MAX_RULE_PATTERN } from '@/db/schema'

/**
 * A category rule, new or changed (docs/specs/released/import-da-file.md, «Regole delle categorie»):
 * the keyword, expenses or income, the category. Saving with the keyword of another rule
 * replaces that one.
 */
export interface RuleDraft {
  pattern: string
  kind: ImportRule['kind']
  categoryId: string
}

const props = defineProps<{
  rule: ImportRule | null
  /** Active categories of both kinds. */
  categories: Category[]
}>()

const emit = defineEmits<{
  save: [draft: RuleDraft]
  delete: [rule: ImportRule]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const pattern = ref('')
const kind = ref<ImportRule['kind']>('expense')
const categoryId = ref<string | null>(null)
const error = ref<string>()

watch(() => [open.value, props.rule] as const, ([isOpen, rule]) => {
  if (!isOpen)
    return
  pattern.value = rule?.pattern ?? ''
  kind.value = rule?.kind ?? 'expense'
  categoryId.value = rule?.categoryId ?? null
  error.value = undefined
}, { immediate: true })

const kindOptions = computed(() => [
  {
    value: 'expense' as const,
    label: t('importRules.expense'),
  },
  {
    value: 'income' as const,
    label: t('importRules.income'),
  },
])
const kindCategories = computed(() => props.categories.filter(category => category.kind === kind.value))

// Another kind, other categories: the choice starts again.
watch(kind, () => {
  if (!kindCategories.value.some(category => category.id === categoryId.value))
    categoryId.value = null
})

function save() {
  const clean = pattern.value.replace(/\s+/g, ' ').trim()
  if (!clean) {
    error.value = t('importRules.sheet.errorEmpty')
    return
  }
  if (clean.length > MAX_RULE_PATTERN) {
    error.value = t('importRules.sheet.errorLong')
    return
  }
  if (!categoryId.value)
    return
  emit('save', { pattern: clean, kind: kind.value, categoryId: categoryId.value })
  open.value = false
}

function remove() {
  if (props.rule)
    emit('delete', props.rule)
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="rule ? t('importRules.sheet.edit') : t('importRules.sheet.new')">
    <div class="import-rule-sheet">
      <TextField
        v-model="pattern"
        :label="t('importRules.sheet.keyword')"
        :hint="t('importRules.sheet.keywordHint')"
        :error="error"
        :maxlength="MAX_RULE_PATTERN"
        autocomplete="off"
        enterkeyhint="done"
        @input="error = undefined"
      />
      <section class="import-rule-sheet__section" aria-labelledby="import-rule-kind">
        <h3 id="import-rule-kind" class="import-rule-sheet__label type-label">
          {{ t('importRules.sheet.kind') }}
        </h3>
        <SegmentedControl v-model="kind" :options="kindOptions" aria-labelledby="import-rule-kind" />
      </section>
      <section class="import-rule-sheet__section" aria-labelledby="import-rule-category">
        <h3 id="import-rule-category" class="import-rule-sheet__label type-label">
          {{ t('importRules.sheet.category') }}
        </h3>
        <CategoryGrid
          :categories="kindCategories"
          selectable
          :selected-id="categoryId"
          :aria-label="t('importRules.sheet.category')"
          @select="categoryId = $event.id"
        />
      </section>
    </div>
    <template #footer>
      <div class="import-rule-sheet__actions">
        <VvButton
          :label="t('importRules.sheet.save')"
          modifiers="primary"
          class="import-rule-sheet__save"
          :disabled="!categoryId"
          @click="save"
        />
        <button v-if="rule" type="button" class="import-rule-sheet__delete type-body" @click="remove">
          {{ t('importRules.sheet.delete') }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.import-rule-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.import-rule-sheet__section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.import-rule-sheet__section > :deep(.segmented-control) {
  align-self: flex-start;
}

.import-rule-sheet__label {
  margin: 0;
}

.import-rule-sheet__actions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}

.import-rule-sheet__save {
  min-height: 3.25rem;
}

/* A quiet action, as «Scollega» in the Google Drive sheet. */
.import-rule-sheet__delete {
  align-self: center;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 0;
  background: none;
  border-radius: var(--rounded);
  color: var(--color-danger);
  font: inherit;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .import-rule-sheet__delete:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.import-rule-sheet__delete:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.import-rule-sheet__delete:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .import-rule-sheet__delete {
    transition: none;
  }
}
</style>
