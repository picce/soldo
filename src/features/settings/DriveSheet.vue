<script setup lang="ts">
import type { BackupOutcome } from '@/backup/auto'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { disconnectDrive, keepDeviceData, runBackup } from '@/backup/auto'
import { SERVICE_ICONS, serviceAuths } from '@/backup/services'
import { backupRunning } from '@/backup/state'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { useDriveStatus } from './useDriveStatus'

/**
 * The service of the automatic backup in the Settings (docs/specs/backup-google-drive.md,
 * "Interfaccia"; Dropbox and OneDrive the same): the account and the state of the backup,
 * then what can be done. What needs the user (the choice after connecting, an expired
 * permission) replaces the usual actions.
 */
const emit = defineEmits<{
  restore: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const { state, service, detail, alert, online } = useDriveStatus()
const icon = computed(() => SERVICE_ICONS[state.value.service])

const mode = computed(() => {
  if (state.value.choice)
    return 'choice'
  if (state.value.error === 'auth')
    return 'auth'
  return 'ready'
})

const explanation = computed(() => {
  const named = { service: service.value }
  if (mode.value === 'choice')
    return t('drive.sheet.choiceText', named)
  if (mode.value === 'auth')
    return t('drive.sheet.authText', named)
  return state.value.error === 'quota'
    ? t('drive.sheet.quotaText', named)
    : t(`drive.where.${state.value.service}`)
})

const OUTCOME_MESSAGES: Partial<Record<BackupOutcome, string>> = {
  uploaded: 'drive.toast.done',
  unchanged: 'drive.toast.unchanged',
  offline: 'drive.toast.offline',
  unavailable: 'drive.toast.failed',
  quota: 'drive.toast.quota',
}

function report(outcome: BackupOutcome) {
  const key = OUTCOME_MESSAGES[outcome]
  if (key) {
    showToast({
      message: t(key, { service: service.value }),
    })
  }
}

// Asked by hand: it uploads even when nothing changed, so the user sees it done.
async function backUpNow() {
  report(await runBackup({ force: true }))
}

async function keepDevice() {
  report(await keepDeviceData())
}

function restore() {
  open.value = false
  emit('restore')
}

function reconnect() {
  if (!online.value) {
    showToast({
      message: t('drive.offline', { service: service.value }),
    })
    return
  }
  serviceAuths[state.value.service].connect('/impostazioni')
}

async function disconnect() {
  const name = service.value
  open.value = false
  await disconnectDrive()
  showToast({
    message: t('drive.toast.disconnected', { service: name }),
  })
}
</script>

<template>
  <BottomSheet v-model="open" :title="service">
    <div class="drive-sheet">
      <p class="drive-sheet__account">
        <AppIcon :name="icon" class="drive-sheet__icon" />
        <span class="drive-sheet__lines">
          <span class="drive-sheet__email type-body">{{ state.account ?? t('drive.sheet.accountUnknown', { service }) }}</span>
          <span class="drive-sheet__status type-small" :class="{ 'drive-sheet__status--alert': alert }">{{ detail }}</span>
        </span>
      </p>
      <p class="drive-sheet__text type-small">
        {{ explanation }}
      </p>
    </div>
    <template #footer>
      <div class="drive-sheet__actions">
        <template v-if="mode === 'choice'">
          <VvButton :label="t('drive.sheet.restore', { service })" modifiers="primary" class="drive-sheet__button" @click="restore" />
          <VvButton :label="t('drive.sheet.keepDevice')" modifiers="secondary" class="drive-sheet__button" @click="keepDevice" />
        </template>
        <template v-else-if="mode === 'auth'">
          <VvButton :label="t('drive.sheet.reconnect', { service })" modifiers="primary" class="drive-sheet__button" @click="reconnect" />
        </template>
        <template v-else>
          <VvButton
            :label="t('drive.sheet.backupNow')"
            modifiers="primary"
            class="drive-sheet__button"
            :loading="backupRunning"
            @click="backUpNow"
          />
          <VvButton :label="t('drive.sheet.restore', { service })" modifiers="secondary" class="drive-sheet__button" @click="restore" />
        </template>
        <button type="button" class="drive-sheet__disconnect type-body" @click="disconnect">
          {{ t('drive.sheet.disconnect', { service }) }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.drive-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.drive-sheet__account {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.drive-sheet__icon {
  --app-icon-size: 1.5rem;

  flex-shrink: 0;
}

.drive-sheet__lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.drive-sheet__email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drive-sheet__status {
  color: var(--color-ink-2);
}

.drive-sheet__status--alert {
  color: var(--color-danger);
}

.drive-sheet__text {
  margin: 0;
  color: var(--color-ink-2);
}

.drive-sheet__actions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}

.drive-sheet__button {
  min-height: 3.25rem;
}

/* A quiet action: the backups stay on Drive, nothing is lost. */
.drive-sheet__disconnect {
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
  .drive-sheet__disconnect:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.drive-sheet__disconnect:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.drive-sheet__disconnect:focus-visible {
  outline: 2px solid var(--color-pen);
}
</style>
