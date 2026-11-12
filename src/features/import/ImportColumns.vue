<script setup lang="ts">
import type { Choice } from '@/components/ChoiceList.vue'
import type { GuessedMapping, SheetLayout } from '@/import/columns'
import type { Cell, ColumnMapping, DateFormat } from '@/import/types'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { sampleOf } from '@/import/columns'

/**
 * The columns of a CSV or Excel statement (docs/specs/released/import-da-file.md, «Colonne»): a row
 * for each field with the column chosen and its first value; a tap opens the list of
 * columns. The amounts are in one column, or in two (Dare and Avere).
 */
const props = defineProps<{
  table: Cell[][]
  layout: SheetLayout
  dateFormat: DateFormat | null
  /** Movements that the mapping reads. */
  count: number
}>()

const mapping = defineModel<GuessedMapping>({ required: true })

type Field = 'date' | 'description' | 'description2' | 'amount' | 'debit' | 'credit'

const { t } = useI18n()

const columnName = (column: number) => props.layout.names[column] ?? t('import.columns.column', { n: column + 1 })

function columnOf(field: Field): number | undefined {
  const value = mapping.value
  switch (field) {
    case 'date':
      return value.date
    case 'description':
      return value.description
    case 'description2':
      return value.description2
    case 'amount':
      return value.amount?.kind === 'single'
        ? value.amount.column
        : undefined
    case 'debit':
      return value.amount?.kind === 'split'
        ? value.amount.debit
        : undefined
    case 'credit':
      return value.amount?.kind === 'split'
        ? value.amount.credit
        : undefined
  }
  return undefined
}

const amountKind = computed<ColumnMapping['amount']['kind']>({
  get: () => mapping.value.amount?.kind ?? 'single',
  set: (kind) => {
    const current = mapping.value.amount
    if (current?.kind === kind)
      return
    const first = current?.kind === 'single'
      ? current.column
      : current?.debit
    const { amount: _, ...rest } = mapping.value
    if (kind === 'single') {
      mapping.value = first === undefined
        ? rest
        : {
            ...rest,
            amount: { kind, column: first },
          }
    }
    else {
      const debit = first ?? 0
      mapping.value = {
        ...rest,
        amount: {
          kind,
          debit,
          credit: Math.min(debit + 1, props.layout.width - 1),
        },
      }
    }
  },
})
const amountOptions = computed(() => [
  {
    value: 'single' as const,
    label: t('import.columns.single'),
  },
  {
    value: 'split' as const,
    label: t('import.columns.split'),
  },
])

const fields = computed<Field[]>(() => amountKind.value === 'single'
  ? [
      'date',
      'description',
      'description2',
      'amount',
    ]
  : [
      'date',
      'description',
      'description2',
      'debit',
      'credit',
    ])
const labelOf = (field: Field) => t(`import.columns.${field}`)

function setColumn(field: Field, column: number | undefined) {
  const value = { ...mapping.value }
  if (field === 'date' || field === 'description' || field === 'description2') {
    if (column === undefined)
      delete value[field]
    else
      value[field] = column
  }
  else if (column !== undefined && field === 'amount') {
    value.amount = { kind: 'single', column }
  }
  else if (column !== undefined) {
    const current = value.amount?.kind === 'split'
      ? value.amount
      : { kind: 'split' as const, debit: column, credit: column }
    value.amount = { ...current, [field]: column }
  }
  mapping.value = value
}

const picking = ref<Field>()
const sheetOpen = computed({
  get: () => picking.value !== undefined,
  set: (open) => {
    if (!open)
      picking.value = undefined
  },
})
const choices = computed<Choice[]>(() => {
  const columns = Array.from({ length: props.layout.width }, (_, column): Choice => ({
    id: String(column),
    title: columnName(column),
    icon: 'file-csv',
    detail: sampleOf(props.table, props.layout, column),
  }))
  return picking.value === 'description2'
    ? [
        {
          id: 'none',
          title: t('import.columns.none'),
          icon: 'x',
        },
        ...columns,
      ]
    : columns
})
const selected = computed(() => {
  if (!picking.value)
    return null
  const column = columnOf(picking.value)
  return column === undefined
    ? (picking.value === 'description2'
        ? 'none'
        : null)
    : String(column)
})

function choose(id: string) {
  if (picking.value) {
    setColumn(picking.value, id === 'none'
      ? undefined
      : Number(id))
  }
  picking.value = undefined
}
</script>

<template>
  <div class="import-columns">
    <section class="import-columns__amounts" aria-labelledby="import-columns-amounts">
      <h3 id="import-columns-amounts" class="import-columns__label type-label">
        {{ t('import.columns.amounts') }}
      </h3>
      <SegmentedControl v-model="amountKind" :options="amountOptions" aria-labelledby="import-columns-amounts" />
    </section>

    <ul class="import-columns__card">
      <li v-for="field in fields" :key="field">
        <button type="button" class="import-columns__row" @click="picking = field">
          <span class="import-columns__text">
            <span class="type-small import-columns__field">{{ labelOf(field) }}</span>
            <span class="type-body import-columns__name">
              {{ columnOf(field) === undefined
                ? (field === 'description2' ? t('import.columns.none') : t('import.columns.missing'))
                : columnName(columnOf(field)!) }}
            </span>
            <span v-if="columnOf(field) !== undefined" class="type-small import-columns__sample">
              {{ sampleOf(table, layout, columnOf(field)!) }}
            </span>
          </span>
          <AppIcon name="caret-down" class="import-columns__caret" />
        </button>
      </li>
    </ul>

    <p class="import-columns__status type-small" role="status">
      <template v-if="dateFormat">
        {{ t(`import.columns.dateFormat.${dateFormat}`) }}
      </template>
      {{ t('import.columns.read', count) }}
    </p>

    <BottomSheet v-model="sheetOpen" :title="picking ? t('import.columns.choose', { field: labelOf(picking) }) : ''">
      <ChoiceList :choices="choices" :selected="selected" :aria-label="picking ? labelOf(picking) : ''" @select="choose" />
    </BottomSheet>
  </div>
</template>

<style scoped>
.import-columns {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.import-columns__amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.import-columns__label {
  margin: 0;
}

.import-columns__card {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.import-columns__card > li + li {
  border-top: 1px solid var(--color-line);
}

.import-columns__row {
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
  .import-columns__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.import-columns__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.import-columns__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .import-columns__row {
    transition: none;
  }
}

.import-columns__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.import-columns__field,
.import-columns__sample {
  color: var(--color-ink-2);
}

.import-columns__name,
.import-columns__sample {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-columns__caret {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

.import-columns__status {
  margin: 0;
  color: var(--color-ink-2);
}
</style>
