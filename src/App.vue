<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppToast from '@/app/components/AppToast.vue'
import BottomNav from '@/app/components/BottomNav.vue'
import LockScreen from '@/app/components/LockScreen.vue'
import ReloadPrompt from '@/app/components/ReloadPrompt.vue'
import RotateNotice from '@/app/components/RotateNotice.vue'
import { locked } from '@/app/lock'
import { dismissToast } from '@/app/toast'

const route = useRoute()
const fullscreen = computed(() => route.meta.fullscreen === true)

// A notice of the page left behind ("Salvato…") does not follow into a full-screen editor.
watch(fullscreen, (isFullscreen) => {
  if (isFullscreen)
    dismissToast()
})
</script>

<template>
  <!-- Behind the lock screen the app is inert: neither a finger nor a screen reader reaches it. -->
  <div class="app-shell" :class="{ 'app-shell--fullscreen': fullscreen }" :inert="locked || undefined">
    <main class="app-shell__main">
      <!-- Keyed by path: /movimenti/a and /movimenti/b are two screens, not one reused. -->
      <RouterView v-slot="{ Component, route: current }">
        <component :is="Component" :key="current.path" />
      </RouterView>
    </main>
    <ReloadPrompt />
    <AppToast />
    <BottomNav v-if="!fullscreen" />
    <RotateNotice />
  </div>
  <LockScreen v-if="locked" />
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-shell__main {
  flex: 1;
  width: 100%;
  max-width: 40rem;
  margin-inline: auto;
  padding: calc(0.75rem + env(safe-area-inset-top)) var(--page-gutter)
    calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 1.5rem);
}

/* Full-screen pages lay out their own margins, edge to edge; notices go on top, off the keypad. */
.app-shell--fullscreen {
  --toast-top: calc(env(safe-area-inset-top) + 0.75rem);
  --toast-bottom: auto;
}

.app-shell--fullscreen .app-shell__main {
  max-width: none;
  padding: 0;
}
</style>
