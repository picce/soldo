<script setup lang="ts">
import type { OpenableReading } from '@/backup/import'
import type { RemoteBackup } from '@/backup/provider'
import { useOnline } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { markOnboarded } from '@/app/onboarding'
import { showToast } from '@/app/toast'
import { connectGoogle, useDriveAvailable } from '@/backup/google/auth'
import { backupState } from '@/backup/state'
import AppIcon from '@/components/AppIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import { requestPersistentStorage } from '@/db/persist'
import { seedDefaults } from '@/db/seed'
import DriveRestoreSheet from '@/features/settings/DriveRestoreSheet.vue'
import RestoreBackup from '@/features/settings/RestoreBackup.vue'
import InstallCard from './InstallCard.vue'

/**
 * First start (docs/specs/released/onboarding.md, mockup "Onboarding"): what Soldo is, how to
 * install it, and the ways in: from scratch (default categories and the cash account), from
 * Google Drive where the site can reach it (docs/specs/backup-google-drive.md), or from a
 * backup file.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const online = useOnline()
const restore = useTemplateRef<InstanceType<typeof RestoreBackup>>('restore')
const busy = ref(false)

const driveAvailable = useDriveAvailable()
const driveOpen = ref(false)
let driveBackup: RemoteBackup | undefined

const points = computed(() => [
  { icon: 'receipt', key: 'twoTaps' },
  { icon: 'device-mobile', key: 'onDevice' },
  driveAvailable.value
    ? { icon: 'google-drive-logo', key: 'backupDrive' }
    : { icon: 'file-arrow-up', key: 'backupFile' },
])

/** `then` runs once the first start is marked, before the Home: it may count as data. */
async function enter(then?: () => Promise<void>) {
  // Asked now and not awaited: the browser may refuse, or (Firefox) ask the user.
  void requestPersistentStorage()
  await markOnboarded()
  await then?.()
  await router.replace({ name: 'home' })
}

/** Connected already: the list. Otherwise to Google, which comes back here with the list. */
function restoreFromDrive() {
  if (backupState.value.connected) {
    driveOpen.value = true
  }
  else if (!online.value) {
    showToast({
      message: t('drive.offline'),
    })
  }
  else {
    connectGoogle('/benvenuto?ripristina=drive')
  }
}

// Back from Google (`?ripristina=drive`): the list opens once the connection is complete.
if (route.query.ripristina === 'drive') {
  void router.replace({ query: {} })
  const stop = watch(() => backupState.value.connected, (connected) => {
    if (!connected)
      return
    driveOpen.value = true
    queueMicrotask(() => stop())
  }, { immediate: true })
}

function confirmDriveBackup(reading: OpenableReading, backup: RemoteBackup) {
  driveBackup = backup
  restore.value?.show(reading)
}

async function onRestored() {
  const backup = driveBackup
  driveBackup = undefined
  if (!backup) {
    await enter()
    return
  }
  // The device now holds that backup: no need to upload it back.
  const { markRestoredFromDrive } = await import('@/backup/auto')
  await enter(() => markRestoredFromDrive(backup))
}

/** Creates the default data once, even on a double tap. */
async function start() {
  if (busy.value)
    return
  busy.value = true
  try {
    await seedDefaults()
    await enter()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="welcome">
    <h1 class="welcome__logo">
      <AppLogo />
    </h1>
    <p class="welcome__motto">
      {{ t('welcome.motto') }}
    </p>

    <ul class="welcome__points">
      <li v-for="point in points" :key="point.key" class="welcome__point">
        <AppIcon :name="point.icon" class="welcome__point-icon" />
        <div>
          <p class="welcome__point-title type-body-strong">
            {{ t(`welcome.points.${point.key}.title`) }}
          </p>
          <p class="welcome__point-detail type-small">
            {{ t(`welcome.points.${point.key}.detail`) }}
          </p>
        </div>
      </li>
    </ul>

    <InstallCard />

    <div class="welcome__actions">
      <VvButton :label="t('welcome.start')" modifiers="primary" class="welcome__button" :disabled="busy" @click="start" />
      <template v-if="driveAvailable">
        <VvButton :label="t('welcome.restoreDrive')" modifiers="secondary" class="welcome__button" :disabled="busy" @click="restoreFromDrive" />
        <button type="button" class="welcome__file type-body" :disabled="busy" @click="restore?.pick()">
          {{ t('welcome.restoreFile') }}
        </button>
      </template>
      <VvButton v-else :label="t('welcome.restore')" modifiers="secondary" class="welcome__button" :disabled="busy" @click="restore?.pick()" />
    </div>
    <RestoreBackup ref="restore" @restored="onRestored" />
    <DriveRestoreSheet v-if="driveAvailable || backupState.connected" v-model:open="driveOpen" @chosen="confirmDriveBackup" />
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: 40rem;
  margin-inline: auto;
  padding: calc(3.5rem + env(safe-area-inset-top)) var(--page-gutter) calc(1.5rem + env(safe-area-inset-bottom));
}

.welcome__logo {
  margin: 0;
  font-size: 3.25rem;
  line-height: 1;
}

.welcome__motto {
  margin: 1rem 0 0;
  color: var(--color-ink-2);
  font-size: 1.0625rem;
}

.welcome__points {
  margin: 2.75rem 0 1.5rem;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-line);
}

.welcome__point {
  display: flex;
  gap: 1rem;
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--color-line);
}

.welcome__point-icon {
  --app-icon-size: 1.5rem;

  margin-top: 0.125rem;
}

.welcome__point-title,
.welcome__point-detail {
  margin: 0;
}

.welcome__point-detail {
  margin-top: 0.125rem;
  color: var(--color-ink-2);
}

.welcome__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 2rem;
}

.welcome__button {
  min-height: 3.25rem;
  font-size: 1rem;
}

/* The third way in, quieter: a file is the rarer case once Drive is there. */
.welcome__file {
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
  .welcome__file:not(:disabled):hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.welcome__file:not(:disabled):active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.welcome__file:focus-visible {
  outline: 2px solid var(--color-pen);
}
</style>
