<script setup lang="ts">
import { pauseToast, resumeToast, runToastAction, useToast } from '@/app/toast'

const { toast } = useToast()
</script>

<template>
  <!-- The live region is always in the page, so screen readers announce every new notice. -->
  <div class="app-toast-region" role="status">
    <Transition name="app-toast">
      <div
        v-if="toast"
        :key="toast.id"
        class="app-toast"
        @pointerenter="pauseToast"
        @pointerleave="resumeToast"
        @focusin="pauseToast"
        @focusout="resumeToast"
      >
        <p class="app-toast__message type-body">
          {{ toast.message }}
        </p>
        <button
          v-if="toast.action"
          type="button"
          class="app-toast__action type-body-strong"
          @click="runToastAction"
        >
          {{ toast.action.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* As in the Movimenti mockup: a card with an ink border, above the navigation. */
.app-toast-region {
  position: fixed;
  inset-inline: var(--page-gutter);
  top: var(--toast-top, auto);
  bottom: var(--toast-bottom, calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 0.75rem));
  z-index: 30;
  max-width: 38rem;
  margin-inline: auto;
  pointer-events: none;
}

.app-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.75rem;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink);
  border-radius: var(--rounded);
  color: var(--color-ink);
  pointer-events: auto;
}

.app-toast__message {
  margin: 0;
  padding-block: 0.5rem;
}

.app-toast__action {
  flex-shrink: 0;
  min-height: 2.75rem;
  padding-inline: 0.5rem;
  border: 0;
  background: none;
  color: var(--color-pen);
  cursor: pointer;
}

.app-toast__action:focus-visible {
  outline: 2px solid var(--color-pen);
  border-radius: var(--rounded);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 0.2s ease,
    translate 0.2s ease;
}

/* A notice that replaces another fades out in the same place. */
.app-toast-leave-active {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  translate: 0 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .app-toast-enter-active,
  .app-toast-leave-active {
    transition: none;
  }
}
</style>
