<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { runBackup } from '@/backup/auto'
import { backupEncryption, disableEncryption, enableEncryption } from '@/backup/encryption'
import { backupState } from '@/backup/state'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import TextField from '@/components/TextField.vue'
import { useIntlLocale } from '@/i18n/locale'

/**
 * Encryption of the backups in the Settings (docs/specs/backup-cifrati.md, "Interfaccia"):
 * off, a passphrase typed twice turns it on; on, it can be changed or turned off.
 */
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const intlLocale = useIntlLocale()

/** Fewer characters are refused: a short passphrase is guessed too easily. */
const MIN_LENGTH = 8

const passphrase = ref('')
const repeat = ref('')
const submitted = ref(false)
const changing = ref(false)
const busy = ref(false)
const firstField = useTemplateRef<InstanceType<typeof TextField>>('firstField')

const active = computed(() => backupEncryption.value !== null)
/** The two fields: to turn it on, or to change the passphrase. */
const editing = computed(() => !active.value || changing.value)

watch(open, (isOpen) => {
  if (!isOpen)
    return
  passphrase.value = ''
  repeat.value = ''
  submitted.value = false
  changing.value = false
})

const since = computed(() => {
  const value = backupEncryption.value?.since
  return value
    ? new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
    : ''
})

const passphraseError = computed(() => submitted.value && passphrase.value.length < MIN_LENGTH
  ? t('encryption.errors.short')
  : undefined)
const repeatError = computed(() => submitted.value && !passphraseError.value && repeat.value !== passphrase.value
  ? t('encryption.errors.mismatch')
  : undefined)

/** A backup now, with the new key, when Drive is connected: the old file of today is replaced. */
function backUpSoon() {
  if (backupState.value.connected)
    void runBackup()
}

async function save() {
  if (busy.value)
    return
  submitted.value = true
  if (passphraseError.value || repeatError.value) {
    firstField.value?.focus()
    return
  }
  const wasActive = active.value
  busy.value = true
  try {
    await enableEncryption(passphrase.value)
    open.value = false
    showToast({
      message: t(wasActive
        ? 'encryption.toast.changed'
        : 'encryption.toast.enabled'),
    })
    backUpSoon()
  }
  catch {
    showToast({
      message: t('encryption.toast.failed'),
    })
  }
  finally {
    busy.value = false
  }
}

function startChange() {
  changing.value = true
  submitted.value = false
}

function disable() {
  disableEncryption()
  open.value = false
  showToast({
    message: t('encryption.toast.disabled'),
  })
  backUpSoon()
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('encryption.title')">
    <div class="encryption-sheet">
      <p v-if="active" class="encryption-sheet__status">
        <AppIcon name="lock" class="encryption-sheet__icon" />
        <span class="encryption-sheet__lines">
          <span class="type-body">{{ t('encryption.active') }}</span>
          <span class="encryption-sheet__since type-small">{{ t('encryption.since', { date: since }) }}</span>
        </span>
      </p>
      <p class="encryption-sheet__text type-small">
        {{ active ? t('encryption.before') : t('encryption.intro') }}
      </p>
      <template v-if="editing">
        <TextField
          ref="firstField"
          v-model="passphrase"
          type="password"
          :label="changing ? t('encryption.newPassphrase') : t('encryption.passphrase')"
          :hint="t('encryption.hint')"
          :error="passphraseError"
          autocomplete="new-password"
          enterkeyhint="next"
        />
        <TextField
          v-model="repeat"
          type="password"
          :label="t('encryption.repeat')"
          :error="repeatError"
          autocomplete="new-password"
          enterkeyhint="done"
          @keydown.enter.prevent="save"
        />
        <p class="encryption-sheet__warning type-small">
          <AppIcon name="warning" class="encryption-sheet__warning-icon" />
          <span>{{ t('encryption.warning') }}</span>
        </p>
      </template>
    </div>
    <template #footer>
      <div class="encryption-sheet__actions">
        <VvButton
          v-if="editing"
          :label="active ? t('encryption.save') : t('encryption.enable')"
          modifiers="primary"
          class="encryption-sheet__button"
          :loading="busy"
          @click="save"
        />
        <template v-else>
          <VvButton :label="t('encryption.change')" modifiers="secondary" class="encryption-sheet__button" @click="startChange" />
          <button type="button" class="encryption-sheet__disable type-body" @click="disable">
            {{ t('encryption.disable') }}
          </button>
        </template>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.encryption-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.encryption-sheet__status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.encryption-sheet__icon {
  --app-icon-size: 1.5rem;

  flex-shrink: 0;
}

.encryption-sheet__lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.encryption-sheet__since,
.encryption-sheet__text {
  color: var(--color-ink-2);
}

.encryption-sheet__text {
  margin: 0;
}

.encryption-sheet__warning {
  display: flex;
  gap: 0.625rem;
  margin: 0;
  color: var(--color-danger);
}

.encryption-sheet__warning-icon {
  --app-icon-size: 1.25rem;

  flex-shrink: 0;
}

.encryption-sheet__actions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}

.encryption-sheet__button {
  min-height: 3.25rem;
}

/* A quiet action, as «Scollega» in the Google Drive sheet. */
.encryption-sheet__disable {
  align-self: center;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 0;
  background: none;
  border-radius: var(--rounded);
  color: var(--color-pen);
  font: inherit;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .encryption-sheet__disable:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.encryption-sheet__disable:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.encryption-sheet__disable:focus-visible {
  outline: 2px solid var(--color-pen);
}
</style>
