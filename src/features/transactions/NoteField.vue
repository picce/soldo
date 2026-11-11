<script setup lang="ts">
import type { TransactionKind } from '@/db/schema'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionChip from '@/components/ActionChip.vue'
import AppIcon from '@/components/AppIcon.vue'
import { listRecentNotes } from '@/db/repositories/transactions'
import { frequentNotes } from '@/domain/notes'

/**
 * Note of a transaction, written in the quick add itself (docs/specs/released/aggiunta-meno-tocchi.md):
 * at rest the small «Nota» button; tapped, a one-line field in its place, with the notes used
 * most often below, one tap each. Enter or a tap elsewhere keeps what is written.
 *
 * The field is always in the page, hidden at rest: the tap on the button focuses it at once,
 * which is what brings up the keyboard on an iPhone.
 */
const props = defineProps<{
  /** The frequent notes are those of transactions of this kind. */
  kind: TransactionKind
}>()

const note = defineModel<string>('note', { required: true })
/** The field is open: the editor hides the other buttons of the row. */
const editing = defineModel<boolean>('editing', { default: false })

const MAX_LENGTH = 200

const { t } = useI18n()
const root = useTemplateRef<HTMLElement>('root')
const input = useTemplateRef<HTMLInputElement>('input')
const draft = ref(note.value)

/** Notes are shown on one line: line breaks and repeated spaces become one space. */
function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

// The note follows what is typed, so a tap on a category saves it without leaving the field.
watch(draft, (text) => {
  note.value = clean(text)
})
watch(note, (value) => {
  if (value !== clean(draft.value))
    draft.value = value
})

// Read the first time the field opens, not with the screen.
const recent = shallowRef<{ kind: TransactionKind, notes: string[] }>()
async function loadNotes() {
  const kind = props.kind
  if (recent.value?.kind === kind)
    return
  const notes = await listRecentNotes(kind)
  if (props.kind === kind)
    recent.value = { kind, notes }
}

const suggestions = computed(() => recent.value?.kind === props.kind
  ? frequentNotes(recent.value.notes, draft.value)
  : [])

function open() {
  input.value?.focus()
}

function onFocus() {
  editing.value = true
  void loadNotes()
}

function onBlur(event: FocusEvent) {
  // The focus moved to a frequent note or to the clear button: still writing.
  if (event.relatedTarget instanceof Node && root.value?.contains(event.relatedTarget))
    return
  draft.value = note.value
  editing.value = false
}

function close() {
  draft.value = note.value
  editing.value = false
  input.value?.blur()
}

function pick(suggestion: string) {
  draft.value = suggestion
  note.value = suggestion
  close()
}

function clear() {
  draft.value = ''
  input.value?.focus()
}
</script>

<template>
  <div ref="root" class="note-field" :class="{ 'note-field--editing': editing }">
    <ActionChip
      v-if="!editing"
      icon="note-pencil"
      :label="note || t('editor.note')"
      :aria-label="note ? t('editor.noteChip', { note }) : undefined"
      class="note-field__chip"
      @click="open"
    />
    <div class="note-field__box" :aria-hidden="editing ? undefined : 'true'">
      <AppIcon name="note-pencil" class="note-field__icon" />
      <input
        ref="input"
        v-model="draft"
        type="text"
        class="note-field__input"
        :aria-label="t('editor.note')"
        :placeholder="t('noteField.placeholder')"
        :maxlength="MAX_LENGTH"
        :tabindex="editing ? undefined : -1"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter.prevent="close"
        @keydown.escape.prevent="close"
      >
      <button
        v-if="editing && draft"
        type="button"
        class="note-field__clear"
        :aria-label="t('noteField.clear')"
        @pointerdown.prevent
        @mousedown.prevent
        @click="clear"
      >
        <AppIcon name="x" />
      </button>
    </div>
    <!-- Over the top of the categories, so nothing moves when the field opens and closes. -->
    <div
      v-if="editing && suggestions.length"
      class="note-field__suggestions"
      role="group"
      :aria-label="t('noteField.frequent')"
    >
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        class="note-field__suggestion"
        @pointerdown.prevent
        @mousedown.prevent
        @click="pick(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.note-field {
  position: relative;
  display: flex;
  min-width: 0;
}

.note-field--editing {
  flex: 1 1 100%;
}

.note-field__chip {
  flex-shrink: 1;
}

/* At rest the field is there but out of sight: the button stands for it. */
.note-field__box {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

/* As high as the buttons it replaces, with the outline of a text field while written in. */
.note-field--editing .note-field__box {
  position: static;
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
  width: auto;
  height: 2.25rem;
  padding-inline: 0.75rem 0.25rem;
  overflow: visible;
  background: var(--color-card);
  border: 1px solid var(--color-pen);
  border-radius: var(--rounded);
  box-shadow: 0 0 0 1px var(--color-pen);
  opacity: 1;
  pointer-events: auto;
}

.note-field__icon {
  --app-icon-size: 1.125rem;

  flex-shrink: 0;
  color: var(--color-ink-2);
}

/* 16 px: a smaller text makes the iPhone zoom into the field. */
.note-field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 1rem;
}

.note-field__input:focus {
  outline: none;
}

.note-field__input::placeholder {
  color: var(--color-ink-2);
}

.note-field__clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: var(--rounded);
  background: none;
  color: var(--color-ink-2);
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);

  --app-icon-size: 1rem;
}

.note-field__suggestions {
  position: absolute;
  inset-inline: calc(-1 * var(--page-gutter));
  top: 100%;
  z-index: 5;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem var(--page-gutter) 0.375rem;
  overflow-x: auto;
  background: var(--color-paper);
  border-bottom: 1px solid var(--color-line);
  scrollbar-width: none;
}

.note-field__suggestions::-webkit-scrollbar {
  display: none;
}

.note-field__suggestion {
  flex-shrink: 0;
  max-width: 14rem;
  height: 2.25rem;
  padding: 0 0.75rem;
  overflow: hidden;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 1.125rem;
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .note-field__clear:hover,
  .note-field__suggestion:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.note-field__clear:active,
.note-field__suggestion:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.note-field__clear:focus-visible,
.note-field__suggestion:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .note-field__clear,
  .note-field__suggestion {
    transition: none;
  }
}
</style>
