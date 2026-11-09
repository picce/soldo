<script setup lang="ts">
import type { OpenableReading } from '@/backup/import'
import type { RemoteBackup } from '@/backup/provider'
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { backupProvider } from '@/backup/auto'
import { errorCode } from '@/backup/provider'
import { patchBackupState } from '@/backup/state'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { useIntlLocale } from '@/i18n/locale'

/**
 * The backups on Google Drive, newest first (docs/specs/backup-google-drive.md): a tap
 * downloads one and hands it over for the confirmation of RestoreBackup, which first asks
 * the passphrase of an encrypted one (docs/specs/backup-cifrati.md).
 */
const emit = defineEmits<{
  chosen: [reading: OpenableReading, backup: RemoteBackup]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const intlLocale = useIntlLocale()
const backups = shallowRef<RemoteBackup[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const downloading = ref<string>()

/** A failure that needs the user: the permission expired. Others are retried with «Riprova». */
function noteFailure(error: unknown) {
  if (errorCode(error) === 'auth')
    patchBackupState({ error: 'auth' })
}

async function load() {
  status.value = 'loading'
  try {
    backups.value = await backupProvider().list()
    status.value = 'ready'
  }
  catch (error) {
    noteFailure(error)
    status.value = 'error'
  }
}

watch(open, (isOpen) => {
  if (isOpen)
    void load()
}, { immediate: true })

async function choose(backup: RemoteBackup) {
  if (downloading.value)
    return
  downloading.value = backup.id
  try {
    const bytes = await backupProvider().download(backup.id)
    const { readBackupBytes } = await import('@/backup/import')
    const reading = await readBackupBytes(bytes, backup.name, backup.checksum)
    if (!reading.ok && reading.error !== 'locked') {
      showToast({
        message: t(`backup.errors.${reading.error}`),
      })
      return
    }
    open.value = false
    emit('chosen', reading, backup)
  }
  catch (error) {
    noteFailure(error)
    showToast({
      message: t('drive.restore.downloadError'),
    })
  }
  finally {
    downloading.value = undefined
  }
}

/** «124 movimenti», and «· cifrato» for an encrypted backup. */
function detail(backup: RemoteBackup) {
  const transactions = t('drive.restore.transactions', backup.transactions)
  return backup.encrypted
    ? `${transactions} · ${t('drive.restore.encrypted')}`
    : transactions
}

/** «5 novembre 2026, 21:14», in the device's time zone. */
function when(timestamp: string) {
  const date = new Date(timestamp)
  const day = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat(intlLocale.value, { hour: '2-digit', minute: '2-digit' }).format(date)
  return `${day}, ${time}`
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('drive.restore.title')">
    <p v-if="status === 'loading'" class="drive-restore__note type-body" role="status">
      {{ t('drive.restore.loading') }}
    </p>
    <div v-else-if="status === 'error'" class="drive-restore__note">
      <p class="type-body" role="alert">
        {{ t('drive.restore.error') }}
      </p>
      <VvButton :label="t('drive.restore.retry')" modifiers="secondary" class="drive-restore__retry" @click="load" />
    </div>
    <p v-else-if="!backups.length" class="drive-restore__note type-body">
      {{ t('drive.restore.empty') }}
    </p>
    <ul v-else class="drive-restore__list">
      <li v-for="backup in backups" :key="backup.id">
        <button
          type="button"
          class="drive-restore__row"
          :disabled="Boolean(downloading)"
          :aria-busy="downloading === backup.id"
          @click="choose(backup)"
        >
          <span class="drive-restore__text">
            <span class="type-body">{{ when(backup.exportedAt) }}</span>
            <span class="drive-restore__detail type-small">
              {{ downloading === backup.id ? t('drive.restore.downloading') : detail(backup) }}
            </span>
          </span>
          <AppIcon name="caret-right" class="drive-restore__caret" />
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>

<style scoped>
.drive-restore__note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 0;
  color: var(--color-ink-2);
}

.drive-restore__note p {
  margin: 0;
}

.drive-restore__retry {
  min-height: 2.75rem;
}

/* Rows in a card, separated by a line (docs/design/README.md, "Elenchi in una scheda"). */
.drive-restore__list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.drive-restore__list > li + li {
  border-top: 1px solid var(--color-line);
}

.drive-restore__row {
  display: flex;
  align-items: center;
  gap: 1rem;
  box-sizing: border-box;
  width: 100%;
  min-height: 3.5rem;
  padding: 0.625rem 1rem;
  border: 0;
  background: var(--color-card);
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.drive-restore__row:disabled {
  cursor: progress;
}

@media (hover: hover) {
  .drive-restore__row:not(:disabled):hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.drive-restore__row:not(:disabled):active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.drive-restore__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

.drive-restore__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.drive-restore__detail {
  color: var(--color-ink-2);
}

.drive-restore__caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}
</style>
