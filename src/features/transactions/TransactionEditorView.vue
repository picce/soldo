<script setup lang="ts">
import type { EditorKind, EditorTarget } from './useTransactionEditor'
import type { CalculatorKey } from '@/domain/calculator'
import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ActionChip from '@/components/ActionChip.vue'
import AppIcon from '@/components/AppIcon.vue'
import CategoryGrid from '@/components/CategoryGrid.vue'
import Keypad from '@/components/Keypad.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import {
  formatExpression,
  formatOperand,
  hasOperator,
  isDigit,
  isEmptyCalculator,
  isOperator,
} from '@/domain/calculator'
import { addDays, formatDate, today } from '@/domain/dates'
import { currencyPlacement, formatAmount, MINUS } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'
import DateSheet from './DateSheet.vue'
import NoteSheet from './NoteSheet.vue'
import { useTransactionEditor } from './useTransactionEditor'

/**
 * Quick add and edit of a transaction (docs/specs/aggiunta-rapida.md): amount on the
 * keypad, then a tap on the category saves. Editing adds Salva, Duplica and Elimina.
 */
const props = defineProps<{
  target: EditorTarget
}>()

const { t } = useI18n()
const router = useRouter()
const intlLocale = useIntlLocale()

/** Back to where the screen was opened from, or to a sensible page when opened directly. */
function close() {
  if (router.options.history.state.back) {
    router.back()
  }
  else {
    void router.replace({
      name: props.target.mode === 'edit'
        ? 'transactions'
        : 'home',
    })
  }
}

const {
  isEdit,
  ready,
  kind,
  calculator,
  amountCents,
  date,
  note,
  categories,
  selectedId,
  hint,
  shakeCount,
  press,
  selectCategory,
  save,
  duplicate,
  remove,
} = useTransactionEditor(props.target, {
  onDone: close,
  onNotFound: () => void router.replace({ name: 'transactions' }),
})

const dateOpen = ref(false)
const noteOpen = ref(false)

const kindOptions = computed<{ value: EditorKind, label: string }[]>(() => [
  {
    value: 'expense',
    label: t('editor.expense'),
  },
  {
    value: 'income',
    label: t('editor.income'),
  },
])

const title = computed(() => {
  if (isEdit)
    return t('editor.edit')
  return kind.value === 'expense'
    ? t('editor.newExpense')
    : t('editor.newIncome')
})

const showsExpression = computed(() => hasOperator(calculator.value))
const expression = computed(() => formatExpression(calculator.value, intlLocale.value))

/** The number as typed while there is no operation, otherwise the result with two decimals. */
const numberText = computed(() => {
  if (showsExpression.value)
    return formatAmount(Math.max(amountCents.value, 0), intlLocale.value, { sign: 'never' })
  if (isEmptyCalculator(calculator.value))
    return formatAmount(0, intlLocale.value)
  return formatOperand(calculator.value.operands[0] ?? '', intlLocale.value)
})

const sign = computed(() => {
  if (amountCents.value <= 0)
    return ''
  return kind.value === 'expense'
    ? MINUS
    : '+'
})

const currency = computed(() => currencyPlacement(intlLocale.value))

const dateLabel = computed(() => {
  const current = today()
  if (date.value === current)
    return t('dateSheet.today')
  if (date.value === addDays(current, -1))
    return t('dateSheet.yesterday')
  const sameYear = date.value.slice(0, 4) === current.slice(0, 4)
  return formatDate(date.value, intlLocale.value, {
    day: 'numeric',
    month: 'short',
    ...(sameYear
      ? {}
      : { year: 'numeric' }),
  })
})

// A physical keyboard works too: digits, comma or point, + − * / and Backspace.
const KEYBOARD_KEYS: Record<string, CalculatorKey> = {
  ',': 'decimal',
  '.': 'decimal',
  'Backspace': 'backspace',
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey || dateOpen.value || noteOpen.value)
    return
  const element = event.target as HTMLElement | null
  if (element?.closest('input, textarea, dialog'))
    return
  const key = isDigit(event.key) || isOperator(event.key)
    ? event.key
    : KEYBOARD_KEYS[event.key]
  if (!key)
    return
  event.preventDefault()
  press(key)
})
</script>

<template>
  <div class="editor" :class="{ 'editor--edit': isEdit }">
    <h1 class="sr-only">
      {{ title }}
    </h1>
    <header class="editor__top">
      <button type="button" class="editor__icon-button" :aria-label="t('common.close')" @click="close">
        <AppIcon name="x" />
      </button>
      <SegmentedControl v-model="kind" :options="kindOptions" :aria-label="t('editor.kind')" class="editor__kind" />
      <button
        v-if="isEdit"
        type="button"
        class="editor__icon-button editor__icon-button--danger"
        :aria-label="t('editor.delete')"
        :disabled="!ready"
        @click="remove"
      >
        <AppIcon name="trash" />
      </button>
    </header>

    <template v-if="ready">
      <section class="editor__amount" :aria-label="t('editor.amount')">
        <p v-if="hint" class="editor__line editor__line--hint type-body-strong" role="alert">
          {{ t(`editor.${hint}`) }}
        </p>
        <p v-else-if="showsExpression" class="editor__line type-note">
          {{ expression }}
        </p>
        <p v-else-if="isEdit" class="editor__line editor__line--label type-label">
          {{ t('editor.editing') }}
        </p>
        <p v-else class="editor__line" />
        <p
          :key="shakeCount"
          class="editor__value"
          :class="{
            'editor__value--shake': shakeCount > 0,
            'editor__value--long': numberText.length > 10,
            'editor__value--empty': amountCents <= 0,
          }"
          aria-live="polite"
          aria-atomic="true"
        >
          <span class="editor__number">{{ sign }}</span>
          <span v-if="currency.position === 'before'" class="editor__currency">{{ currency.symbol }}</span>
          <span class="editor__number">{{ numberText }}</span>
          <span v-if="currency.position === 'after'" class="editor__currency">&nbsp;{{ currency.symbol }}</span>
        </p>
      </section>

      <div class="editor__chips">
        <ActionChip
          icon="calendar-blank"
          class="editor__date-chip"
          :label="dateLabel"
          :aria-label="t('editor.dateChip', { date: dateLabel })"
          @click="dateOpen = true"
        />
        <ActionChip
          icon="note-pencil"
          :label="note || t('editor.note')"
          :aria-label="note ? t('editor.noteChip', { note }) : undefined"
          class="editor__note-chip"
          @click="noteOpen = true"
        />
      </div>

      <section class="editor__categories" aria-labelledby="editor-categories-title">
        <div class="editor__categories-head">
          <h2 id="editor-categories-title" class="editor__categories-title type-label">
            {{ t('editor.category') }}
          </h2>
          <span class="type-note">{{ isEdit ? t('editor.tapToChange') : t('editor.tapToSave') }}</span>
        </div>
        <CategoryGrid
          :categories="categories"
          :selectable="isEdit"
          :selected-id="selectedId"
          @select="selectCategory"
        />
      </section>

      <div v-if="isEdit" class="editor__actions">
        <VvButton :label="t('editor.duplicate')" modifiers="secondary" class="editor__action" @click="duplicate">
          <template #before>
            <AppIcon name="copy" class="editor__action-icon" />
          </template>
        </VvButton>
        <VvButton :label="t('editor.save')" modifiers="primary" class="editor__action" @click="save">
          <template #before>
            <AppIcon name="check" class="editor__action-icon" />
          </template>
        </VvButton>
      </div>

      <div class="editor__keypad">
        <Keypad @press="press" />
      </div>
    </template>

    <DateSheet v-model:open="dateOpen" v-model:date="date" />
    <NoteSheet v-model:open="noteOpen" v-model:note="note" />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 40rem;
  margin-inline: auto;
  padding-top: calc(0.75rem + env(safe-area-inset-top));
}

.editor__top {
  display: grid;
  grid-template-columns: 2.75rem 1fr 2.75rem;
  align-items: center;
  gap: 0.5rem;
  padding-inline: var(--page-gutter);
}

.editor__kind {
  justify-self: center;
}

/* 34 px buttons with a 44 px touch area (docs/design/README.md, "Forme e spaziature"). */
.editor__icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  margin: 0.3125rem;
  padding: 0;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 0.375rem;
  color: var(--color-ink);
  cursor: pointer;
}

.editor__icon-button::after {
  content: '';
  position: absolute;
  inset: -0.3125rem;
}

.editor__icon-button:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.editor__icon-button .app-icon {
  --app-icon-size: 1.25rem;
}

.editor__icon-button--danger {
  grid-column: 3;
  color: var(--color-danger);
}

.editor__amount {
  padding: 1.25rem var(--page-gutter) 0;
  text-align: end;
}

.editor__line {
  height: 1.25rem;
  line-height: 1.25rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor__line--hint {
  color: var(--color-danger);
}

.editor__line--label {
  color: var(--color-ink-2);
}

.editor__value {
  margin: 0;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--color-ink);
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  line-height: 1.25;
  white-space: nowrap;
}

.editor__value--empty {
  color: var(--color-ink-2);
}

.editor__value--long {
  font-size: 1.875rem;
}

.editor__currency {
  color: var(--color-ink-2);
  font-size: 0.8em;
}

.editor__value--shake {
  animation: editor-shake 0.32s ease;
}

@keyframes editor-shake {
  20% {
    translate: -6px 0;
  }
  40% {
    translate: 6px 0;
  }
  60% {
    translate: -4px 0;
  }
  80% {
    translate: 4px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor__value--shake {
    animation: none;
  }
}

.editor__chips {
  display: flex;
  gap: 0.75rem;
  padding: 1rem var(--page-gutter) 0;
}

.editor__date-chip {
  flex-shrink: 0;
}

.editor__note-chip {
  flex-shrink: 1;
}

.editor__categories {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem var(--page-gutter) 1rem;
}

.editor__categories-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.editor__categories-title {
  margin: 0;
}

.editor__actions {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem var(--page-gutter);
  background: var(--color-paper);
  border-top: 1px solid var(--color-line);
}

.editor__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
}

.editor__action-icon {
  --app-icon-size: 1.25rem;
}

.editor__keypad {
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-card);
}

.editor--edit .editor__keypad {
  --keypad-key-height: 3.25rem;
}
</style>
