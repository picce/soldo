import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dismissToast,
  pauseToast,
  resumeToast,
  runToastAction,
  showToast,
  TOAST_DURATION,
  useToast,
} from './toast'

const { toast } = useToast()

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  dismissToast()
  vi.useRealTimers()
})

describe('toast', () => {
  it('closes by itself after five seconds', () => {
    showToast({ message: 'Salvato' })
    expect(toast.value?.message).toBe('Salvato')
    vi.advanceTimersByTime(TOAST_DURATION - 1)
    expect(toast.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(toast.value).toBeNull()
  })

  it('shows one notice at a time', () => {
    showToast({ message: 'Primo' })
    vi.advanceTimersByTime(3000)
    showToast({ message: 'Secondo' })
    vi.advanceTimersByTime(3000)
    expect(toast.value?.message).toBe('Secondo')
  })

  it('runs the action once and closes', async () => {
    const run = vi.fn()
    showToast({
      message: 'Eliminato',
      action: { label: 'Annulla', run },
    })
    await runToastAction()
    await runToastAction()
    expect(run).toHaveBeenCalledOnce()
    expect(toast.value).toBeNull()
  })

  it('waits while paused and restarts the countdown on resume', () => {
    showToast({ message: 'Eliminato' })
    pauseToast()
    vi.advanceTimersByTime(TOAST_DURATION * 2)
    expect(toast.value).not.toBeNull()
    resumeToast()
    vi.advanceTimersByTime(TOAST_DURATION)
    expect(toast.value).toBeNull()
  })
})
