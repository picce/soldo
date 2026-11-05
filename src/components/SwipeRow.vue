<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

/**
 * A row that can be swiped sideways (docs/specs/movimenti.md, mockup "Riga scorsa").
 * Under the row appears the action of that side; past 40% of the width it turns solid,
 * with a short vibration, and on release `swipe` is emitted with the direction. Below the
 * threshold the row goes back. A gesture counts only if it is more horizontal than
 * vertical, so the list keeps scrolling; a swipe never turns into a tap on the row.
 */
export interface SwipeAction {
  label: string
  icon: string
  tone: 'danger' | 'pen'
}

const props = defineProps<{
  /** Action of a swipe to the left, shown on the right. */
  leftAction?: SwipeAction
  /** Action of a swipe to the right, shown on the left. */
  rightAction?: SwipeAction
}>()

const emit = defineEmits<{
  swipe: [direction: 'left' | 'right']
}>()

/** Share of the row width a swipe must pass to trigger its action. */
const THRESHOLD = 0.4
/** Movement before deciding whether the gesture is a swipe or a scroll. */
const SLOP = 8

const root = useTemplateRef<HTMLElement>('root')
const offset = ref(0)
const dragging = ref(false)
const settling = ref(false)
const width = ref(1)

let start: { id: number, x: number, y: number } | null = null
let mode: 'undecided' | 'swipe' | 'scroll' = 'undecided'
let suppressClick = false
let timer: ReturnType<typeof setTimeout> | undefined

const direction = computed(() => offset.value < 0
  ? 'left'
  : offset.value > 0
    ? 'right'
    : null)
const action = computed(() => direction.value === 'left'
  ? props.leftAction
  : direction.value === 'right'
    ? props.rightAction
    : undefined)
const past = computed(() => offset.value !== 0 && Math.abs(offset.value) >= width.value * THRESHOLD)

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function onPointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || settling.value)
    return
  start = { id: event.pointerId, x: event.clientX, y: event.clientY }
  width.value = root.value?.offsetWidth || 1
  mode = 'undecided'
}

function onPointerMove(event: PointerEvent) {
  if (!start || event.pointerId !== start.id || mode === 'scroll')
    return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (mode === 'undecided') {
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP)
      return
    if (Math.abs(dy) >= Math.abs(dx)) {
      mode = 'scroll'
      return
    }
    mode = 'swipe'
    dragging.value = true
    root.value?.setPointerCapture?.(event.pointerId)
  }
  const allowed = (dx < 0 && props.leftAction) || (dx > 0 && props.rightAction)
  const wasPast = past.value
  offset.value = allowed ? dx : 0
  if (past.value && !wasPast && 'vibrate' in navigator)
    navigator.vibrate(10)
}

function settle(to: number, then?: () => void) {
  settling.value = true
  offset.value = to
  const finish = () => {
    settling.value = false
    offset.value = 0
    then?.()
  }
  if (reducedMotion())
    finish()
  else
    timer = setTimeout(finish, 180)
}

function onPointerUp(event: PointerEvent) {
  if (!start || event.pointerId !== start.id)
    return
  const triggered = mode === 'swipe' && past.value
    ? direction.value
    : null
  suppressClick = mode === 'swipe'
  start = null
  mode = 'undecided'
  dragging.value = false
  if (triggered === 'left')
    settle(-width.value, () => emit('swipe', 'left'))
  else if (triggered === 'right')
    settle(0, () => emit('swipe', 'right'))
  else if (offset.value)
    settle(0)
}

function onPointerCancel() {
  start = null
  mode = 'undecided'
  dragging.value = false
  if (offset.value)
    settle(0)
}

// After a swipe the browser still sends a click to the row under the finger: drop it.
function onClickCapture(event: MouseEvent) {
  if (suppressClick) {
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    ref="root"
    class="swipe-row"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @click.capture="onClickCapture"
    @dragstart.prevent
  >
    <div
      v-if="action"
      class="swipe-row__action"
      :class="[`swipe-row__action--${direction}`, { [`swipe-row__action--${action.tone}`]: past }]"
      aria-hidden="true"
    >
      <AppIcon :name="action.icon" :weight="past ? 'regular' : 'light'" />
      <span :class="past ? 'type-body-strong' : 'type-body'">{{ action.label }}</span>
    </div>
    <div
      class="swipe-row__content"
      :class="{ 'swipe-row__content--dragging': dragging }"
      :style="offset ? { translate: `${offset}px 0` } : undefined"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.swipe-row {
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
}

.swipe-row__action {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding-inline: 1.25rem;
  background: var(--color-grid);
  color: var(--color-ink-2);
}

.swipe-row__action--left {
  justify-content: flex-end;
}

.swipe-row__action--danger {
  background: var(--color-danger);
  color: var(--color-on-danger);
}

.swipe-row__action--pen {
  background: var(--color-pen);
  color: var(--color-on-pen);
}

.swipe-row__content {
  position: relative;
  background: var(--color-card);
  transition: translate 0.18s ease;
}

.swipe-row__content--dragging {
  transition: none;
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .swipe-row__content {
    transition: none;
  }
}
</style>
