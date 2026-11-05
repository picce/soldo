import { readonly, shallowRef } from 'vue'

/**
 * Notices above the navigation ("Salvato: −12,40 € · Spesa", "Eliminato: … · Annulla"),
 * rendered by AppToast in App.vue. One at a time: a new notice replaces the current one.
 */

export const TOAST_DURATION = 5000

export interface ToastAction {
  label: string
  run: () => unknown
}

export interface Toast {
  id: number
  message: string
  action?: ToastAction
}

export interface ToastOptions {
  message: string
  /** Optional button, e.g. "Annulla". The notice closes when it is pressed. */
  action?: ToastAction
  /** Milliseconds before it closes by itself. */
  duration?: number
}

const current = shallowRef<Toast | null>(null)
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined
let currentDuration = TOAST_DURATION

function startTimer(duration: number) {
  clearTimeout(timer)
  currentDuration = duration
  const id = current.value?.id
  timer = setTimeout(() => {
    if (current.value?.id === id)
      current.value = null
  }, duration)
}

export function showToast(options: ToastOptions): Toast {
  const toast: Toast = { id: nextId++, message: options.message, action: options.action }
  current.value = toast
  startTimer(options.duration ?? TOAST_DURATION)
  return toast
}

export function dismissToast() {
  clearTimeout(timer)
  current.value = null
}

/** Stops the countdown while the pointer or the focus is on the notice; `resumeToast` restarts it. */
export function pauseToast() {
  clearTimeout(timer)
}

export function resumeToast() {
  if (current.value)
    startTimer(currentDuration)
}

export async function runToastAction() {
  const action = current.value?.action
  dismissToast()
  await action?.run()
}

export function useToast() {
  return {
    toast: readonly(current),
  }
}
