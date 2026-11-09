<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { PIN_LENGTH, unlock, waitUntil } from '@/app/lock'
import AppLogo from '@/components/AppLogo.vue'
import PinDots from '@/components/PinDots.vue'
import PinPad from '@/components/PinPad.vue'

/**
 * The lock screen (docs/specs/blocco-pin.md, "Schermata di blocco"): over everything until
 * the right PIN. The fourth digit checks it; a wrong one shakes the dots. «Hai dimenticato il
 * PIN?» can only erase the data of this device, after asking twice.
 */
const { t } = useI18n()
const titleId = useId()

const pin = ref('')
const checking = ref(false)
const wrong = ref(false)
const shaking = ref(false)
const now = ref(Date.now())
const waitingUntil = ref(waitUntil())
/** «Hai dimenticato il PIN?»: the explanation, then the second confirmation. */
const forgot = ref<'no' | 'explain' | 'confirm'>('no')
const erasing = ref(false)

const secondsLeft = computed(() => Math.max(0, Math.ceil((waitingUntil.value - now.value) / 1000)))
const waiting = computed(() => secondsLeft.value > 0)

const message = computed(() => {
  if (waiting.value) {
    return t('lock.wait', {
      time: waitText(secondsLeft.value),
    })
  }
  if (wrong.value)
    return t('lock.wrong')
  return ''
})

/** «30 secondi», «2 minuti». */
function waitText(seconds: number) {
  return seconds > 90
    ? t('lock.minutes', Math.ceil(seconds / 60))
    : t('lock.seconds', seconds)
}

async function check() {
  checking.value = true
  try {
    const result = await unlock(pin.value)
    if (result === 'ok')
      return
    pin.value = ''
    wrong.value = true
    waitingUntil.value = waitUntil()
    now.value = Date.now()
    if ('vibrate' in navigator)
      navigator.vibrate([40, 40, 40])
    shaking.value = true
  }
  finally {
    checking.value = false
  }
}

function onDigit(digit: string) {
  if (checking.value || pin.value.length >= PIN_LENGTH)
    return
  wrong.value = false
  pin.value += digit
  if (pin.value.length === PIN_LENGTH)
    void check()
}

function onDelete() {
  pin.value = pin.value.slice(0, -1)
}

async function erase() {
  if (forgot.value !== 'confirm') {
    forgot.value = 'confirm'
    return
  }
  erasing.value = true
  const { eraseDeviceData } = await import('@/app/reset')
  await eraseDeviceData()
}
const screen = useTemplateRef<HTMLElement>('screen')

/** A keyboard types the PIN too: digits, and Backspace to delete. */
function onKeydown(event: KeyboardEvent) {
  if (forgot.value !== 'no' || waiting.value || event.metaKey || event.ctrlKey || event.altKey)
    return
  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    onDigit(event.key)
  }
  else if (event.key === 'Backspace') {
    event.preventDefault()
    onDelete()
  }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  window.addEventListener('keydown', onKeydown)
  // The focus moves into the screen: what had it is behind, inert.
  screen.value?.focus()
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="screen" class="lock-screen" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
    <div class="lock-screen__top">
      <p class="lock-screen__logo">
        <AppLogo />
      </p>
      <h1 :id="titleId" class="lock-screen__title type-title">
        {{ t('lock.title') }}
      </h1>
      <PinDots :filled="pin.length" :total="PIN_LENGTH" :shake="shaking" @shaken="shaking = false" />
      <p class="lock-screen__message type-small" role="alert">
        {{ message }}
      </p>
    </div>
    <div v-if="forgot === 'no'" class="lock-screen__bottom">
      <PinPad :disabled="waiting || checking" @digit="onDigit" @delete="onDelete" />
      <button type="button" class="lock-screen__link type-body" @click="forgot = 'explain'">
        {{ t('lock.forgot') }}
      </button>
    </div>
    <div v-else class="lock-screen__bottom lock-screen__forgot">
      <p class="type-body">
        {{ t('lock.forgotText') }}
      </p>
      <VvButton
        :label="forgot === 'confirm' ? t('lock.eraseConfirm') : t('lock.erase')"
        modifiers="danger"
        class="lock-screen__button"
        :loading="erasing"
        @click="erase"
      />
      <VvButton :label="t('common.cancel')" modifiers="secondary" class="lock-screen__button" :disabled="erasing" @click="forgot = 'no'" />
    </div>
  </div>
</template>

<style scoped>
/* Over everything, notices and navigation included; the app behind is inert (App.vue). */
.lock-screen:focus {
  outline: none;
}

.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.5rem;
  box-sizing: border-box;
  padding: calc(env(safe-area-inset-top) + 2rem) var(--page-gutter) calc(env(safe-area-inset-bottom) + 1.5rem);
  overflow-y: auto;
  background: var(--color-paper);
  color: var(--color-ink);
}

.lock-screen__top,
.lock-screen__bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 22rem;
  margin-inline: auto;
}

.lock-screen__bottom {
  align-items: stretch;
}

.lock-screen__logo {
  margin: 0;
  font-size: 1.75rem;
}

.lock-screen__title {
  margin: 0;
}

.lock-screen__message {
  min-height: 1.25rem;
  margin: 0;
  color: var(--color-danger);
  text-align: center;
}

.lock-screen__forgot p {
  margin: 0;
}

.lock-screen__button {
  min-height: 3.25rem;
}

/* A quiet action, as «Scollega» in the Google Drive sheet. */
.lock-screen__link {
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
  .lock-screen__link:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.lock-screen__link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.lock-screen__link:focus-visible {
  outline: 2px solid var(--color-pen);
}
</style>
