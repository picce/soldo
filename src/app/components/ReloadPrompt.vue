<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000
const OFFLINE_READY_TIMEOUT = 6000

const { t } = useI18n()

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration)
      return
    // Periodic update check for people who keep the app open for a long time.
    setInterval(async () => {
      if (registration.installing || !navigator.onLine)
        return
      const response = await fetch(swUrl, { cache: 'no-store' }).catch(() => undefined)
      if (response?.status === 200)
        await registration.update()
    }, UPDATE_CHECK_INTERVAL)
  },
})

function close() {
  needRefresh.value = false
  offlineReady.value = false
}

// The "ready offline" notice is informative only: it goes away by itself.
watch(offlineReady, (ready) => {
  if (ready)
    setTimeout(() => offlineReady.value = false, OFFLINE_READY_TIMEOUT)
})
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="reload-prompt" role="status">
    <template v-if="needRefresh">
      <div class="reload-prompt__text">
        <p class="type-body-strong">
          {{ t('pwa.updateTitle') }}
        </p>
        <p class="type-small reload-prompt__detail">
          {{ t('pwa.updateContent') }}
        </p>
      </div>
      <div class="reload-prompt__actions">
        <VvButton :label="t('pwa.dismiss')" modifiers="secondary" @click="close" />
        <VvButton :label="t('pwa.updateAction')" modifiers="primary" @click="updateServiceWorker(true)" />
      </div>
    </template>
    <div v-else class="reload-prompt__row">
      <p class="type-body">
        {{ t('pwa.offlineReady') }}
      </p>
      <button type="button" class="reload-prompt__link type-body-strong" @click="close">
        {{ t('pwa.close') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Same look as the notices in the mockups: a card with an ink border above the navigation. */
.reload-prompt {
  position: fixed;
  inset-inline: var(--page-gutter);
  top: var(--toast-top, auto);
  bottom: var(--toast-bottom, calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 0.75rem));
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 38rem;
  margin-inline: auto;
  padding: 0.75rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink);
  border-radius: var(--rounded);
  color: var(--color-ink);
}

.reload-prompt p {
  margin: 0;
}

.reload-prompt__detail {
  color: var(--color-ink-2);
}

.reload-prompt__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.reload-prompt__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.reload-prompt__link {
  min-height: 2.75rem;
  padding-inline: 0.25rem;
  color: var(--color-pen);
  cursor: pointer;
}

.reload-prompt__link:focus-visible {
  outline: 2px solid var(--color-pen);
  border-radius: var(--rounded);
}
</style>
