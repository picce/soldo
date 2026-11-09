<script setup lang="ts">
import type { LockDelay } from '@/app/lock'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { appLock, changeLockDelay, DELAY_NAMES, disableLock, enableLock, LOCK_DELAYS, PIN_LENGTH } from '@/app/lock'
import { showToast } from '@/app/toast'
import BottomSheet from '@/components/BottomSheet.vue'
import PinDots from '@/components/PinDots.vue'
import PinPad from '@/components/PinPad.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'

/**
 * The PIN lock in the Settings (docs/specs/blocco-pin.md, "Impostazioni"): off, a PIN typed
 * twice turns it on; on, when it locks, a new PIN, or off.
 */
const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

/** Choosing a PIN: the first time, then again to be sure. */
const step = ref<'idle' | 'choose' | 'repeat'>('idle')
const pin = ref('')
const first = ref('')
const mismatch = ref(false)
const shaking = ref(false)
const busy = ref(false)

const active = computed(() => appLock.value !== null)

watch(open, (isOpen) => {
  if (isOpen)
    reset('idle')
})

function reset(next: typeof step.value) {
  step.value = next
  pin.value = ''
  first.value = ''
  mismatch.value = false
}

type DelayName = typeof DELAY_NAMES[LockDelay]

// The segments carry the names of the delays: SegmentedControl takes strings.
const delayOptions = computed(() => LOCK_DELAYS.map(value => ({
  value: DELAY_NAMES[value],
  label: t(`lockSheet.delays.${DELAY_NAMES[value]}`),
})))

const delay = computed<DelayName>({
  get: () => DELAY_NAMES[appLock.value?.after ?? 0],
  set: name => changeLockDelay(LOCK_DELAYS.find(value => DELAY_NAMES[value] === name) ?? 0),
})

const prompt = computed(() => {
  if (step.value === 'repeat')
    return t('lockSheet.repeat')
  return t('lockSheet.choose', { n: PIN_LENGTH })
})

async function save(chosen: string) {
  const wasActive = active.value
  busy.value = true
  try {
    await enableLock(chosen, appLock.value?.after ?? 0)
    open.value = false
    showToast({
      message: t(wasActive
        ? 'lockSheet.toast.changed'
        : 'lockSheet.toast.enabled'),
    })
  }
  finally {
    busy.value = false
  }
}

function onDigit(digit: string) {
  if (busy.value || pin.value.length >= PIN_LENGTH)
    return
  mismatch.value = false
  pin.value += digit
  if (pin.value.length < PIN_LENGTH)
    return
  if (step.value === 'choose') {
    first.value = pin.value
    pin.value = ''
    step.value = 'repeat'
  }
  else if (pin.value === first.value) {
    void save(pin.value)
  }
  else {
    reset('choose')
    mismatch.value = true
    shaking.value = true
  }
}

function onDelete() {
  pin.value = pin.value.slice(0, -1)
}

function disable() {
  disableLock()
  open.value = false
  showToast({
    message: t('lockSheet.toast.disabled'),
  })
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('lockSheet.title')">
    <div class="lock-sheet">
      <template v-if="step === 'idle'">
        <p class="lock-sheet__text type-small">
          {{ t('lockSheet.intro') }}
        </p>
        <div v-if="active" class="lock-sheet__delay">
          <h3 id="lock-sheet-delay" class="lock-sheet__label type-label">
            {{ t('lockSheet.when') }}
          </h3>
          <SegmentedControl v-model="delay" :options="delayOptions" aria-labelledby="lock-sheet-delay" />
        </div>
      </template>
      <template v-else>
        <p class="lock-sheet__prompt type-body">
          {{ prompt }}
        </p>
        <PinDots :filled="pin.length" :total="PIN_LENGTH" :shake="shaking" @shaken="shaking = false" />
        <p class="lock-sheet__error type-small" role="alert">
          {{ mismatch ? t('lockSheet.mismatch') : '' }}
        </p>
        <PinPad :disabled="busy" @digit="onDigit" @delete="onDelete" />
      </template>
    </div>
    <template v-if="step === 'idle'" #footer>
      <div class="lock-sheet__actions">
        <VvButton
          :label="active ? t('lockSheet.change') : t('lockSheet.enable')"
          :modifiers="active ? 'secondary' : 'primary'"
          class="lock-sheet__button"
          @click="reset('choose')"
        />
        <button v-if="active" type="button" class="lock-sheet__disable type-body" @click="disable">
          {{ t('lockSheet.disable') }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.lock-sheet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lock-sheet__text {
  margin: 0;
  color: var(--color-ink-2);
}

.lock-sheet__delay {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.lock-sheet__label {
  margin: 0;
}

.lock-sheet__prompt {
  margin: 0;
  text-align: center;
}

.lock-sheet__error {
  min-height: 1.25rem;
  margin: 0;
  color: var(--color-danger);
  text-align: center;
}

.lock-sheet__actions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
}

.lock-sheet__button {
  min-height: 3.25rem;
}

/* A quiet action, as «Scollega» in the Google Drive sheet. */
.lock-sheet__disable {
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
  .lock-sheet__disable:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.lock-sheet__disable:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.lock-sheet__disable:focus-visible {
  outline: 2px solid var(--color-pen);
}
</style>
