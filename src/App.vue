<script setup lang="ts">
import BottomNav from '@/app/components/BottomNav.vue'
import ReloadPrompt from '@/app/components/ReloadPrompt.vue'
</script>

<template>
  <div class="app-shell">
    <main class="app-shell__main">
      <RouterView />
    </main>
    <ReloadPrompt />
    <BottomNav />
  </div>
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
</style>
