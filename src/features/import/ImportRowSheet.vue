<script setup lang="ts">
import type { PreviewRow } from './preview'
import type { Category } from '@/db/schema'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import CheckRow from '@/components/CheckRow.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TextField from '@/components/TextField.vue'
import { MAX_RULE_PATTERN } from '@/db/schema'
import { formatDate } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'
import { suggestKeyword } from '@/import/rules'

/**
 * A row of the import preview, changed (docs/specs/import-da-file.md): its category, a rule
 * for the descriptions that contain a keyword, whether it merges with what was typed by hand,
 * whether it goes in at all. «Fatto» applies; closing the sheet leaves the row as it was.
 */
export interface RowChange {
  categoryId: string | undefined
  include: boolean
  merge: boolean
  /** A keyword to remember with the category. */
  rule?: string
}

const props = defineProps<{
  item: PreviewRow | null
  /** Active categories of both kinds. */
  categories: Category[]
}>()

const emit = defineEmits<{
  apply: [change: RowChange]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const intlLocale = useIntlLocale()

const categoryId = ref<string>()
const include = ref(true)
const merge = ref<'merge' | 'import'>('merge')
const remember = ref(false)
const keyword = ref('')
const keywordError = ref<string>()

watch(() => [open.value, props.item] as const, ([isOpen, item]) => {
  if (!isOpen || !item)
    return
  categoryId.value = item.categoryId
  include.value = item.include
  merge.value = item.merge
    ? 'merge'
    : 'import'
  remember.value = false
  keyword.value = suggestKeyword(item.row.description)
  keywordError.value = undefined
}, { immediate: true })

const kindCategories = computed(() => props.categories.filter(category => category.kind === props.item?.kind))
const changedCategory = computed(() => !!props.item && categoryId.value !== props.item.categoryId)
// Choosing another category proposes the rule at once: it is what saves the next taps.
watch(changedCategory, (changed) => {
  remember.value = changed && keyword.value !== ''
})

const duplicate = computed(() => props.item?.duplicateOf)
const merging = computed(() => !!duplicate.value && merge.value === 'merge')
const mergeOptions = computed(() => [
  {
    value: 'merge' as const,
    label: t('import.row.merge'),
  },
  {
    value: 'import' as const,
    label: t('import.row.importAnyway'),
  },
])
const duplicateText = computed(() => {
  const item = duplicate.value
  if (!item)
    return ''
  return [
    item.note,
    formatAmount(item.kind === 'expense'
      ? -item.amountCents
      : item.amountCents, intlLocale.value, { currency: true }),
    formatDate(item.date, intlLocale.value, { day: 'numeric', month: 'long' }),
  ].filter(Boolean).join(' · ')
})
const date = computed(() => props.item
  ? formatDate(props.item.row.date, intlLocale.value, { weekday: 'long', day: 'numeric', month: 'long' })
  : '')

function done() {
  const rule = remember.value && changedCategory.value && include.value && !merging.value
    ? keyword.value.replace(/\s+/g, ' ').trim()
    : undefined
  if (rule !== undefined) {
    if (!rule) {
      keywordError.value = t('importRules.sheet.errorEmpty')
      return
    }
    if (rule.length > MAX_RULE_PATTERN) {
      keywordError.value = t('importRules.sheet.errorLong')
      return
    }
  }
  emit('apply', {
    categoryId: categoryId.value,
    include: include.value,
    merge: merge.value === 'merge',
    ...(rule
      ? { rule }
      : {}),
  })
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('import.row.title')">
    <div v-if="item" class="import-row-sheet">
      <div class="import-row-sheet__summary">
        <p class="import-row-sheet__description type-body">
          {{ item.row.description }}
        </p>
        <p class="import-row-sheet__meta type-small">
          <span>{{ date }}</span>
          <AmountText :cents="item.row.amountCents" :sign="item.row.amountCents > 0 ? 'always' : 'auto'" currency colored />
        </p>
      </div>

      <CheckRow v-model="include" :label="t('import.row.include')" class="import-row-sheet__check" />

      <template v-if="include">
        <section v-if="duplicate" class="import-row-sheet__section" aria-labelledby="import-row-duplicate">
          <h3 id="import-row-duplicate" class="import-row-sheet__label type-label">
            {{ t('import.row.duplicate') }}
          </h3>
          <p class="import-row-sheet__duplicate type-body">
            {{ duplicateText }}
          </p>
          <SegmentedControl v-model="merge" :options="mergeOptions" aria-labelledby="import-row-duplicate" aria-describedby="import-row-merge-hint" />
          <p id="import-row-merge-hint" class="import-row-sheet__hint type-small">
            {{ t('import.row.mergeHint') }}
          </p>
        </section>

        <section v-if="!merging" class="import-row-sheet__section" aria-labelledby="import-row-category">
          <h3 id="import-row-category" class="import-row-sheet__label type-label">
            {{ t('import.row.category') }}
          </h3>
          <CategoryGrid
            :categories="kindCategories"
            selectable
            :selected-id="categoryId ?? null"
            :aria-label="t('import.row.category')"
            @select="categoryId = $event.id"
          />
          <template v-if="changedCategory">
            <CheckRow v-model="remember" :label="t('import.row.remember')" class="import-row-sheet__check" />
            <TextField
              v-if="remember"
              v-model="keyword"
              :label="t('import.row.keyword')"
              :hint="t('import.row.keywordHint')"
              :error="keywordError"
              :maxlength="MAX_RULE_PATTERN"
              autocomplete="off"
              enterkeyhint="done"
              @input="keywordError = undefined"
            />
          </template>
        </section>
      </template>
    </div>
    <template #footer>
      <VvButton :label="t('import.row.done')" modifiers="primary" class="import-row-sheet__done" @click="done" />
    </template>
  </BottomSheet>
</template>

<style scoped>
.import-row-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.import-row-sheet__summary {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.import-row-sheet__description {
  margin: 0;
  overflow-wrap: anywhere;
}

.import-row-sheet__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
  color: var(--color-ink-2);
}

.import-row-sheet__check {
  margin-inline: -0.75rem;
}

.import-row-sheet__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.import-row-sheet__label,
.import-row-sheet__duplicate,
.import-row-sheet__hint {
  margin: 0;
}

.import-row-sheet__hint {
  color: var(--color-ink-2);
}

.import-row-sheet__done {
  flex: 1;
  min-height: 3.25rem;
}
</style>
