<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isIos, isStandalone, promptInstall, useInstall } from '@/app/install'
import AppIcon from '@/components/AppIcon.vue'

/**
 * «Installa Soldo» on the welcome page (mockups "Onboarding" and "Installa su Android"):
 * on iPhone how to add it to the home screen, and why (Safari may delete the data of a
 * site not installed); where the browser offers it, the «Installa» button; elsewhere,
 * where to find installation in the browser menu. Hidden once installed.
 */
const { t } = useI18n()
const { canPrompt, installed } = useInstall()

const ios = isIos()
const hidden = computed(() => installed.value || isStandalone())
const text = computed(() => {
  if (ios)
    return t('welcome.install.ios')
  return canPrompt.value
    ? t('welcome.install.prompt')
    : t('welcome.install.menu')
})
</script>

<template>
  <section v-if="!hidden" class="install-card" aria-labelledby="install-card-title">
    <AppIcon :name="ios ? 'export' : 'device-mobile'" class="install-card__icon" />
    <div class="install-card__text">
      <h2 id="install-card-title" class="install-card__title type-body-strong">
        {{ t('welcome.install.title') }}
      </h2>
      <p class="install-card__detail type-small">
        {{ text }}
      </p>
    </div>
    <VvButton
      v-if="!ios && canPrompt"
      :label="t('welcome.install.button')"
      modifiers="secondary"
      class="install-card__button"
      @click="promptInstall"
    />
  </section>
</template>

<style scoped>
.install-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.install-card__icon {
  --app-icon-size: 1.5rem;

  align-self: flex-start;
  margin-top: 0.125rem;
}

.install-card__text {
  flex: 1;
  min-width: 0;
}

.install-card__title,
.install-card__detail {
  margin: 0;
}

.install-card__detail {
  color: var(--color-ink-2);
}

.install-card__button {
  flex-shrink: 0;
  min-height: 2.25rem;
  font-weight: 500;
}
</style>
