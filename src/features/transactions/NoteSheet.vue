<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'

/**
 * Note of a transaction (mockup "Nota"). «Fatto» keeps it, «Rimuovi nota» clears it;
 * closing the sheet in another way leaves the note as it was.
 */
const open = defineModel<boolean>('open', { required: true })
const note = defineModel<string>('note', { required: true })

const MAX_LENGTH = 200

const { t } = useI18n()
const draft = ref('')

watch(open, (isOpen) => {
  if (isOpen)
    draft.value = note.value
})

function done() {
  // Notes are shown on one line: line breaks and repeated spaces become one space.
  note.value = draft.value.replace(/\s+/g, ' ').trim()
  open.value = false
}

function remove() {
  note.value = ''
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('noteSheet.title')">
    <textarea
      v-model="draft"
      class="note-sheet__input type-body"
      :aria-label="t('noteSheet.title')"
      :maxlength="MAX_LENGTH"
      rows="4"
      autofocus
      @keydown.enter.exact.prevent="done"
    />
    <p class="note-sheet__count type-note" aria-hidden="true">
      {{ draft.length }}/{{ MAX_LENGTH }}
    </p>
    <template #footer>
      <VvButton
        :label="t('noteSheet.remove')"
        modifiers="secondary"
        class="note-sheet__button"
        :disabled="!draft && !note"
        @click="remove"
      />
      <VvButton :label="t('noteSheet.done')" modifiers="primary" class="note-sheet__button" @click="done" />
    </template>
  </BottomSheet>
</template>

<style scoped>
.note-sheet__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 7.5rem;
  padding: 0.75rem 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink-2);
  border-radius: var(--rounded);
  color: var(--color-ink);
  resize: none;
}

.note-sheet__input:focus {
  outline: none;
  border-color: var(--color-pen);
  box-shadow: 0 0 0 1px var(--color-pen);
}

.note-sheet__count {
  margin: 0.75rem 0 0;
  text-align: end;
}

.note-sheet__button {
  flex: 1;
  min-height: 3.25rem;
}
</style>
