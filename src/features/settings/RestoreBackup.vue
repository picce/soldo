<script setup lang="ts">
import type { BackupReading } from '@/backup/import'
import { computed, ref, shallowRef, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import { useIntlLocale } from '@/i18n/locale'

type ValidReading = Extract<BackupReading, { ok: true }>

/**
 * Restore of a backup file (docs/specs/released/backup-manuale.md, mockup "Importa backup"): `pick()`
 * opens the file chooser; a valid file shows what it holds and asks for confirmation,
 * because the data on the device is replaced. `show(reading)` asks the same for a backup
 * read elsewhere (Google Drive). Used by Settings and by the onboarding.
 */
const emit = defineEmits<{
  restored: []
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()
const titleId = useId()
const input = useTemplateRef<HTMLInputElement>('input')
const reading = shallowRef<ValidReading>()
const open = ref(false)
const busy = ref(false)

function pick() {
  input.value?.click()
}

function show(next: ValidReading) {
  reading.value = next
  open.value = true
}

defineExpose({ pick, show })

async function onChange() {
  const file = input.value?.files?.[0]
  if (input.value)
    input.value.value = ''
  if (!file)
    return
  // The validation library is loaded only now, not with the Settings page.
  const { readBackup } = await import('@/backup/import')
  const result = await readBackup(file)
  if (!result.ok) {
    showToast({
      message: t(`backup.errors.${result.error}`),
    })
    return
  }
  reading.value = result
  open.value = true
}

async function confirm() {
  const backup = reading.value?.backup
  if (!backup || busy.value)
    return
  busy.value = true
  try {
    const { restoreBackup } = await import('@/backup/import')
    await restoreBackup(backup)
    open.value = false
    showToast({
      message: t('backup.restored'),
    })
    emit('restored')
  }
  catch {
    open.value = false
    showToast({
      message: t('backup.restoreError'),
    })
  }
  finally {
    busy.value = false
  }
}

const preview = computed(() => {
  const value = reading.value?.preview
  if (!value)
    return []
  // «2 novembre 2026, 21:14», in the device's time zone.
  const created = new Date(value.exportedAt)
  const date = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(created)
  const time = new Intl.DateTimeFormat(intlLocale.value, { hour: '2-digit', minute: '2-digit' }).format(created)
  const count = new Intl.NumberFormat(intlLocale.value)
  return [
    {
      label: t('backup.file'),
      value: value.fileName,
    },
    {
      label: t('backup.created'),
      value: `${date}, ${time}`,
    },
    {
      label: t('backup.transactions'),
      value: count.format(value.transactions),
    },
    {
      label: t('backup.categoriesAccounts'),
      value: `${count.format(value.categories)} · ${count.format(value.accounts)}`,
    },
  ]
})
</script>

<template>
  <input
    ref="input"
    type="file"
    accept=".json,.gz,application/json,application/gzip"
    hidden
    @change="onChange"
  >
  <VvDialog v-model="open" class="restore-backup" :aria-labelledby="titleId" :keep-open="busy">
    <template #header>
      <h2 :id="titleId" class="restore-backup__title type-title">
        {{ t('backup.restoreTitle') }}
      </h2>
    </template>
    <dl class="restore-backup__preview">
      <div v-for="row in preview" :key="row.label" class="restore-backup__row">
        <dt class="restore-backup__label type-body">
          {{ row.label }}
          <span class="dot-leader" aria-hidden="true" />
        </dt>
        <dd class="restore-backup__value type-amount">
          {{ row.value }}
        </dd>
      </div>
    </dl>
    <p class="restore-backup__warning type-body">
      <AppIcon name="warning" class="restore-backup__warning-icon" />
      <span>{{ t('backup.warning') }}</span>
    </p>
    <template #footer>
      <VvButton :label="t('common.cancel')" modifiers="secondary" class="restore-backup__button" :disabled="busy" @click="open = false" />
      <VvButton :label="t('backup.restore')" modifiers="danger" class="restore-backup__button" :loading="busy" @click="confirm" />
    </template>
  </VvDialog>
</template>

<style scoped>
/* The dialog is the veil over the page; the article inside is the window. */
.restore-backup {
  --vv-dialog-padding: 0;

  background-color: var(--color-scrim);
  backdrop-filter: none;
}

.restore-backup::backdrop {
  background: transparent;
}

.restore-backup :deep(.vv-dialog__wrapper) {
  width: min(26rem, 100vw - 2 * var(--page-gutter));
  max-width: none;
  margin: auto;
  background: var(--color-card);
  border: 1px solid var(--color-ink);
  border-radius: 0.75rem;
  box-shadow: none;
  color: var(--color-ink);
}

.restore-backup :deep(.vv-dialog__header) {
  padding: 1.5rem 1.25rem 1rem;
  background: transparent;
  border: 0;
}

.restore-backup :deep(.vv-dialog__content) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0 1.25rem 1.25rem;
}

.restore-backup :deep(.vv-dialog__footer) {
  gap: 0.75rem;
  padding: 0 1.25rem 1.25rem;
  background: transparent;
  border: 0;
}

.restore-backup__title {
  margin: 0;
}

.restore-backup__preview {
  margin: 0;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.restore-backup__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  padding: 0.25rem 0.75rem;
}

.restore-backup__row + .restore-backup__row {
  border-top: 1px solid var(--color-line);
}

/* The label keeps its words, a long value (the file name) is cut with an ellipsis. */
.restore-backup__label {
  display: flex;
  flex: 1 0 auto;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-ink-2);
  white-space: nowrap;
}

.restore-backup__value {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-backup__warning {
  display: flex;
  gap: 0.625rem;
  margin: 0;
  color: var(--color-danger);
}

.restore-backup__warning-icon {
  --app-icon-size: 1.25rem;

  margin-top: 0.0625rem;
}

.restore-backup__button {
  flex: 1;
  min-height: 3.25rem;
}
</style>
