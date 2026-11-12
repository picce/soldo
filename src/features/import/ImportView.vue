<script setup lang="ts">
import type { RowChange } from './ImportRowSheet.vue'
import type { Fallbacks, PreviewRow } from './preview'
import type { Choice } from '@/components/ChoiceList.vue'
import type { ImportRuleInput } from '@/db/repositories/import'
import type { Transaction } from '@/db/schema'
import type { GuessedMapping, SheetLayout } from '@/import/columns'
import type { Statement, StatementError } from '@/import/read'
import type { DateFormat, ImportedRow } from '@/import/types'
import { computed, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import SubPage from '@/components/SubPage.vue'
import { accountName } from '@/db/names'
import { listAccounts } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import {
  commitImport,
  duplicateCandidates,
  fallbackCategories,
  findImportPreset,
  importedExternalIds,
  listImportRules,
  undoImport,
} from '@/db/repositories/import'
import { useLiveQuery } from '@/db/useLiveQuery'
import DayGroup from '@/features/transactions/DayGroup.vue'
import { dateFormatOf, findLayout, guessMapping, isComplete, rowsOf, signatureOf } from '@/import/columns'
import { findPossibleDuplicates } from '@/import/duplicates'
import { externalIds } from '@/import/external-id'
import { readStatement } from '@/import/read'
import ImportColumns from './ImportColumns.vue'
import ImportRow from './ImportRow.vue'
import ImportRowSheet from './ImportRowSheet.vue'
import { buildPreview, countPreview, recategorize, toPlan, withRule } from './preview'
import { takeSharedStatement } from './shared'

/**
 * Import of a bank statement (docs/specs/released/import-da-file.md, "Interfaccia"): one step at a
 * time, written in the address (`?passo=`), so Indietro and the back gesture go to the step
 * before. File, account, columns (CSV and Excel only, skipped when the bank's file is known)
 * and preview; «Importa» adds everything at once and goes to Movimenti, with «Annulla».
 */
type Step = 'file' | 'account' | 'columns' | 'preview'
const STEP_QUERY: Record<Exclude<Step, 'file'>, string> = {
  account: 'conto',
  columns: 'colonne',
  preview: 'anteprima',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const step = computed<Step>(() => {
  const value = route.query.passo
  const found = (Object.keys(STEP_QUERY) as Exclude<Step, 'file'>[]).find(key => STEP_QUERY[key] === value)
  return found ?? 'file'
})

function goTo(next: Step) {
  void router.push({
    query: next === 'file'
      ? {}
      : { passo: STEP_QUERY[next] },
  })
}

const { data } = useLiveQuery(async () => {
  const [accounts, categories] = await Promise.all([
    listAccounts(),
    listCategories(),
  ])
  return { accounts, categories }
})
const accounts = computed(() => data.value?.accounts ?? [])
const categories = computed(() => data.value?.categories ?? [])

// The file and how it is read.
const statement = shallowRef<Statement>()
const layout = shallowRef<SheetLayout | null>(null)
const mapping = ref<GuessedMapping>({})
const dateFormat = ref<DateFormat | null>(null)
const signature = ref('')
const knownBank = ref(false)
const accountId = ref<string>()
const reading = ref(false)
const fileError = ref<string>()

const sheet = computed(() => statement.value?.kind === 'sheet'
  ? statement.value
  : undefined)

const rows = computed<ImportedRow[]>(() => {
  const value = statement.value
  if (!value)
    return []
  if (value.kind === 'rows')
    return value.rows
  const current = mapping.value
  return layout.value && isComplete(current) && dateFormat.value
    ? rowsOf(value.table, layout.value, current, dateFormat.value)
    : []
})

// A new date column brings its own way of writing dates.
watch(() => mapping.value.date, (column) => {
  if (sheet.value && layout.value && column !== undefined && !knownBank.value)
    dateFormat.value = dateFormatOf(sheet.value.table, layout.value, column)
})

const input = useTemplateRef<HTMLInputElement>('input')

function pick() {
  input.value?.click()
}

async function onFile() {
  const file = input.value?.files?.[0]
  if (input.value)
    input.value.value = ''
  if (file)
    await open(file)
}

function fail(error: StatementError | 'noTable' | 'shared') {
  fileError.value = t(`import.file.errors.${error}`)
}

function defaultAccount(preferred?: string): string | undefined {
  const active = accounts.value
  if (preferred && active.some(account => account.id === preferred))
    return preferred
  return active.find(account => account.type === 'bank')?.id ?? active[0]?.id
}

/** Reads the file, finds how this bank's file was read before, and goes to the account. */
async function open(file: File) {
  fileError.value = undefined
  reading.value = true
  try {
    const result = await readStatement(file)
    if (!result.ok) {
      fail(result.error)
      return
    }
    let preferred: string | undefined
    knownBank.value = false
    layout.value = null
    if (result.statement.kind === 'sheet') {
      const found = findLayout(result.statement.table)
      if (!found) {
        fail('noTable')
        return
      }
      layout.value = found
      signature.value = signatureOf(found)
      const preset = await findImportPreset(signature.value)
      const fits = (column: number | undefined) => column === undefined || column < found.width
      const mapped = preset?.mapping
      if (preset && mapped && fits(mapped.date) && fits(mapped.description) && fits(mapped.description2)
        && (mapped.amount.kind === 'single'
          ? fits(mapped.amount.column)
          : fits(mapped.amount.debit) && fits(mapped.amount.credit))) {
        mapping.value = mapped
        dateFormat.value = preset.dateFormat
        knownBank.value = true
        preferred = preset.accountId
      }
      else {
        const guess = guessMapping(result.statement.table, found)
        mapping.value = guess
        dateFormat.value = guess.date === undefined
          ? null
          : dateFormatOf(result.statement.table, found, guess.date)
      }
    }
    statement.value = result.statement
    accountId.value = defaultAccount(preferred)
    goTo('account')
  }
  finally {
    reading.value = false
  }
}

// The account.
const accountChoices = computed<Choice[]>(() => accounts.value.map(account => ({
  id: account.id,
  title: accountName(account),
  icon: account.icon,
  color: account.color,
})))

async function chooseAccount(id: string) {
  accountId.value = id
  if (sheet.value && !(knownBank.value && rows.value.length)) {
    goTo('columns')
    return
  }
  await preparePreview()
  goTo('preview')
}

// The columns.
async function confirmColumns() {
  // Columns changed by hand: the dates follow the new column, not the preset.
  knownBank.value = false
  await preparePreview()
  goTo('preview')
}

// The preview.
const previewRows = ref<PreviewRow[]>([])
const importedCount = ref(0)
const savedRules = shallowRef<ImportRuleInput[]>([])
const newRules = ref<ImportRuleInput[]>([])
const fallbacks = ref<Fallbacks>({ expense: undefined, income: undefined })
const previewReady = ref(false)

async function preparePreview() {
  const current = rows.value
  const ids = await externalIds(current)
  const [imported, rules, fallback] = await Promise.all([
    importedExternalIds(ids),
    listImportRules(),
    fallbackCategories(),
  ])
  const fresh = current
    .map((row, index) => ({ key: ids[index]!, date: row.date, amountCents: row.amountCents }))
    .filter(row => !imported.has(row.key))
  const duplicates = new Map<string, Transaction>()
  if (fresh.length) {
    const dates = fresh.map(row => row.date).sort()
    const candidates = (await duplicateCandidates(dates[0]!, dates[dates.length - 1]!))
      .filter(candidate => candidate.transaction.accountId === accountId.value)
    const byId = new Map(candidates.map(candidate => [candidate.id, candidate.transaction]))
    for (const [key, id] of findPossibleDuplicates(fresh, candidates))
      duplicates.set(key, byId.get(id)!)
  }
  // Rules of archived categories wait: the rows go to the fallback.
  const active = new Set(categories.value.map(category => category.id))
  savedRules.value = rules.filter(rule => active.has(rule.categoryId))
  newRules.value = []
  fallbacks.value = fallback
  const result = buildPreview({
    rows: current,
    ids,
    imported,
    duplicates,
    rules: savedRules.value,
    fallbacks: fallback,
  })
  previewRows.value = result.rows
  importedCount.value = result.importedCount
  previewReady.value = true
}

const counts = computed(() => countPreview(previewRows.value))
const total = computed(() => counts.value.add + counts.value.merge)
const summary = computed(() => [
  t('import.preview.new', previewRows.value.length),
  ...(counts.value.merge
    ? [
        t('import.preview.merge', counts.value.merge),
      ]
    : []),
  ...(importedCount.value
    ? [
        t('import.preview.imported', importedCount.value),
      ]
    : []),
].join(' · '))

const categoryById = computed(() => new Map(categories.value.map(category => [category.id, category])))

const days = computed(() => {
  const groups: { date: string, rows: PreviewRow[], totalCents: number }[] = []
  for (const row of previewRows.value) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== row.row.date) {
      group = { date: row.row.date, rows: [], totalCents: 0 }
      groups.push(group)
    }
    group.rows.push(row)
    if (row.include && !(row.duplicateOf && row.merge))
      group.totalCents += row.row.amountCents
  }
  return groups
})

const editing = ref<PreviewRow | null>(null)
const rowSheetOpen = ref(false)

function openRow(row: PreviewRow) {
  editing.value = row
  rowSheetOpen.value = true
}

function applyRow(change: RowChange) {
  const target = editing.value
  if (!target)
    return
  previewRows.value = previewRows.value.map(row => row.key === target.key
    ? {
        ...row,
        include: change.include,
        merge: change.merge,
        categoryId: change.categoryId,
        manual: row.manual || change.categoryId !== row.categoryId,
      }
    : row)
  if (change.rule && change.categoryId) {
    newRules.value = withRule(newRules.value, { pattern: change.rule, kind: target.kind, categoryId: change.categoryId })
    // The rules chosen now come first: they win over a saved one with the same keyword.
    previewRows.value = recategorize(previewRows.value, [
      ...newRules.value,
      ...savedRules.value,
    ], fallbacks.value)
  }
}

const busy = ref(false)

async function commit() {
  if (!accountId.value || busy.value)
    return
  busy.value = true
  try {
    const current = mapping.value
    // Plain copies: IndexedDB cannot store the reactive proxies of Vue.
    const preset = sheet.value && isComplete(current) && dateFormat.value
      ? {
          signature: signature.value,
          mapping: JSON.parse(JSON.stringify(current)) as typeof current,
          dateFormat: dateFormat.value,
        }
      : undefined
    const plan = toPlan(accountId.value, previewRows.value, newRules.value, preset)
    const result = await commitImport(plan)
    const count = plan.add.length + plan.merge.length
    await router.replace({ name: 'transactions' })
    showToast({
      message: t('import.done', count),
      action: {
        label: t('common.undo'),
        run: async () => {
          await undoImport(result)
          showToast({
            message: t('import.undone'),
          })
        },
      },
    })
  }
  catch {
    showToast({
      message: t('import.failed'),
    })
  }
  finally {
    busy.value = false
  }
}

// A step without what it needs (a reload, an address typed by hand) starts again.
watch(step, (current) => {
  if (current !== 'file' && !statement.value) {
    void router.replace({ query: {} })
  }
  else if (current === 'preview' && !previewReady.value) {
    void router.replace({
      query: { passo: STEP_QUERY.account },
    })
  }
}, { immediate: true })

// From «Condividi» on Android (docs/specs/released/import-da-file.md): the file is waiting.
onMounted(async () => {
  if (route.query.condiviso === undefined)
    return
  const file = await takeSharedStatement()
  if (file)
    await open(file)
  else
    fail('shared')
})
</script>

<template>
  <SubPage :title="t('import.title')" :back="{ name: 'settings' }">
    <input
      ref="input"
      type="file"
      accept=".csv,.txt,.xlsx,.ofx,.qfx,.qif,.xml,text/csv,text/plain,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/x-ofx,application/qif"
      hidden
      @change="onFile"
    >

    <section v-if="step === 'file'" class="import__step" aria-labelledby="import-file">
      <AppIcon name="file-arrow-down" class="import__hero" />
      <h2 id="import-file" class="import__title type-title">
        {{ t('import.file.title') }}
      </h2>
      <p class="import__text type-body">
        {{ t('import.file.text') }}
      </p>
      <p class="import__muted type-small">
        {{ t('import.file.again') }}
      </p>
      <p v-if="fileError" class="import__error type-small" role="alert">
        {{ fileError }}
      </p>
      <VvButton
        :label="reading ? t('import.file.reading') : t('import.file.choose')"
        modifiers="primary"
        class="import__choose"
        :disabled="reading"
        @click="pick"
      />
    </section>

    <section v-else-if="step === 'account'" class="import__step" aria-labelledby="import-account">
      <h2 id="import-account" class="import__title type-title">
        {{ t('import.account.title') }}
      </h2>
      <p class="import__muted type-small">
        {{ statement?.fileName }} · {{ t('import.account.hint') }}
      </p>
      <ChoiceList
        :choices="accountChoices"
        :selected="accountId"
        :aria-label="t('import.account.title')"
        class="import__card"
        @select="chooseAccount"
      />
    </section>

    <section v-else-if="step === 'columns' && sheet && layout" class="import__step" aria-labelledby="import-columns">
      <h2 id="import-columns" class="import__title type-title">
        {{ t('import.columns.title') }}
      </h2>
      <p class="import__muted type-small">
        {{ t('import.columns.hint') }}
      </p>
      <ImportColumns
        v-model="mapping"
        :table="sheet.table"
        :layout="layout"
        :date-format="dateFormat"
        :count="rows.length"
      />
    </section>

    <section v-else-if="step === 'preview'" class="import__step" aria-labelledby="import-preview">
      <h2 id="import-preview" class="import__title type-title">
        {{ t('import.preview.title') }}
      </h2>
      <p class="import__muted type-small">
        {{ summary }}
      </p>
      <button v-if="sheet" type="button" class="import__link type-body" @click="goTo('columns')">
        {{ t('import.preview.columns') }}
      </button>
      <p v-if="!previewRows.length" class="import__text type-body">
        {{ t('import.preview.nothing') }}
      </p>
      <template v-else>
        <p class="import__muted type-small">
          {{ t('import.preview.hint') }}
        </p>
        <div class="import__days" role="region" :aria-label="t('import.preview.list')">
          <DayGroup v-for="day in days" :key="day.date" :date="day.date" :total-cents="day.totalCents">
            <li v-for="row in day.rows" :key="row.key">
              <ImportRow :item="row" :category="row.categoryId ? categoryById.get(row.categoryId) : undefined" @open="openRow(row)" />
            </li>
          </DayGroup>
        </div>
      </template>
      <ImportRowSheet v-model:open="rowSheetOpen" :item="editing" :categories="categories" @apply="applyRow" />
    </section>

    <template v-if="step === 'columns' || (step === 'preview' && previewRows.length)" #footer>
      <VvButton
        v-if="step === 'columns'"
        :label="t('import.columns.continue')"
        modifiers="primary"
        class="import__action"
        :disabled="!rows.length"
        @click="confirmColumns"
      />
      <VvButton
        v-else
        :label="busy ? t('import.preview.busy') : t('import.preview.commit', total)"
        modifiers="primary"
        class="import__action"
        :disabled="!total || busy"
        @click="commit"
      >
        <template #before>
          <AppIcon name="check" class="import__action-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.import__step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.import__hero {
  --app-icon-size: 2.5rem;

  align-self: center;
  margin-top: 1.5rem;
  color: var(--color-ink-2);
}

.import__title,
.import__text,
.import__muted,
.import__error {
  margin: 0;
}

.import__muted {
  color: var(--color-ink-2);
}

.import__error {
  color: var(--color-danger);
}

.import__choose {
  min-height: 3.25rem;
  margin-top: 0.5rem;
}

.import__card {
  margin-top: 0.25rem;
}

.import__days {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 0.25rem;
}

/* A quiet action, as «Scollega» in the Google Drive sheet. */
.import__link {
  align-self: flex-start;
  min-height: 2.75rem;
  margin-inline: -0.75rem;
  padding: 0 0.75rem;
  border: 0;
  background: none;
  border-radius: var(--rounded);
  color: var(--color-pen);
  font: inherit;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .import__link:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.import__link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.import__link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .import__link {
    transition: none;
  }
}

.import__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.import__action-icon {
  --app-icon-size: 1.25rem;
}
</style>
