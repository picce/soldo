import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, useToast } from '@/app/toast'
import { startBackup } from './start'
import { patchBackupState, resetBackupState } from './state'

const engine = vi.hoisted(() => ({
  completeConnection: vi.fn(async () => {}),
  startAutoBackup: vi.fn(),
}))

vi.mock('./auto', () => engine)

const { toast } = useToast()

beforeEach(() => {
  resetBackupState()
  engine.completeConnection.mockClear()
  engine.startAutoBackup.mockClear()
})

afterEach(() => {
  dismissToast()
  history.replaceState(null, '', '/')
})

describe('startBackup', () => {
  it('completes the connection on the way back from Google and clears the address', async () => {
    history.replaceState(null, '', '/benvenuto?ripristina=drive&google=connected')
    startBackup()
    expect(location.pathname + location.search).toBe('/benvenuto?ripristina=drive')
    await vi.waitFor(() => expect(toast.value?.message).toBe('Google Drive collegato: il backup parte da solo.'))
    expect(engine.completeConnection).toHaveBeenCalledOnce()
  })

  it('explains a sign-in that did not end well', () => {
    history.replaceState(null, '', '/impostazioni?google=scope')
    startBackup()
    expect(location.search).toBe('')
    expect(toast.value?.message).toBe('Per il backup serve il permesso su Google Drive: riprova e lascialo spuntato.')
    expect(engine.completeConnection).not.toHaveBeenCalled()

    history.replaceState(null, '', '/impostazioni?google=whatever')
    startBackup()
    expect(toast.value?.message).toBe('Non è stato possibile collegare Google Drive. Riprova.')
  })

  it('starts the engine only when Drive is connected', async () => {
    startBackup()
    await Promise.resolve()
    expect(engine.startAutoBackup).not.toHaveBeenCalled()

    patchBackupState({ connected: true })
    startBackup()
    await vi.waitFor(() => expect(engine.startAutoBackup).toHaveBeenCalledOnce())
  })
})
