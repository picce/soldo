<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { markOnboarded } from '@/app/onboarding'
import AppIcon from '@/components/AppIcon.vue'
import AppLogo from '@/components/AppLogo.vue'
import { requestPersistentStorage } from '@/db/persist'
import { seedDefaults } from '@/db/seed'
import RestoreBackup from '@/features/settings/RestoreBackup.vue'
import InstallCard from './InstallCard.vue'

/**
 * First start (docs/specs/released/onboarding.md, mockup "Onboarding"): what Soldo is, how to
 * install it, and two ways in: from scratch (default categories and the cash account)
 * or from a backup file.
 */
const { t } = useI18n()
const router = useRouter()
const restore = useTemplateRef<InstanceType<typeof RestoreBackup>>('restore')
const busy = ref(false)

// Phase 2: the backup is a file. With Phase 3 the third point promises Google Drive.
const POINTS = [
  { icon: 'receipt', key: 'twoTaps' },
  { icon: 'device-mobile', key: 'onDevice' },
  { icon: 'file-arrow-up', key: 'backupFile' },
] as const

async function enter() {
  // Asked now and not awaited: the browser may refuse, or (Firefox) ask the user.
  void requestPersistentStorage()
  await markOnboarded()
  await router.replace({ name: 'home' })
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
      <li v-for="point in POINTS" :key="point.key" class="welcome__point">
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
      <VvButton :label="t('welcome.restore')" modifiers="secondary" class="welcome__button" :disabled="busy" @click="restore?.pick()" />
    </div>
    <RestoreBackup ref="restore" @restored="enter" />
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
</style>
