<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useI18n } from 'vue-i18n'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000

const { t } = useI18n()

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration)
      return
    // Controllo periodico degli aggiornamenti per chi tiene l'app aperta a lungo.
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
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="reload-prompt">
    <VvAlert
      v-if="needRefresh"
      modifiers="info"
      :title="t('pwa.updateTitle')"
      :content="t('pwa.updateContent')"
    >
      <template #footer>
        <div class="reload-prompt__actions">
          <VvButton :label="t('pwa.dismiss')" modifiers="secondary" @click="close" />
          <VvButton :label="t('pwa.updateAction')" modifiers="primary" @click="updateServiceWorker(true)" />
        </div>
      </template>
    </VvAlert>
    <VvAlert
      v-else
      modifiers="success"
      :content="t('pwa.offlineReady')"
      :close-label="t('pwa.close')"
      :auto-close="6000"
      dismissable
      @close="close"
    />
  </div>
</template>

<style scoped>
.reload-prompt {
  position: fixed;
  inset-inline: var(--spacing-md);
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--spacing-sm));
  z-index: 20;
  max-width: 38rem;
  margin-inline: auto;
}

.reload-prompt__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
