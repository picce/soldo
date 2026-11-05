import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/app/router'
import { resetGoogleAuth } from '@/backup/google/auth'
import { forgetDriveFolder } from '@/backup/google/drive'
import { patchBackupState, resetBackupState } from '@/backup/state'
import { db } from '@/db/database'
import { archiveCategory, listCategories } from '@/db/repositories/categories'
import { setMeta } from '@/db/repositories/meta'
import { seedDefaults } from '@/db/seed'
import { applyLocale, LOCALE_STORAGE_KEY } from '@/i18n/locale'
import { createFakeDrive, fakeDriveFetch } from '@/test/fake-drive'
import { testPlugins } from '@/test/plugins'
import SettingsView from './SettingsView.vue'

// happy-dom has no ARIA reflection, so aria-pressed shows up only as the "pressed" class.
function pressedLabel(wrapper: ReturnType<typeof mountSettings>) {
  return wrapper.findAll('button').filter(button => button.classes('pressed')).map(button => button.text())
}

function mountSettings() {
  return mount(SettingsView, {
    global: {
      plugins: testPlugins(createAppRouter(createMemoryHistory())),
      // VvDialog opens its <dialog> when its transition runs: the default stub never does.
      stubs: { transition: false },
    },
  })
}

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  await seedDefaults()
  resetBackupState()
  resetGoogleAuth()
  forgetDriveFolder()
})

afterEach(() => {
  localStorage.clear()
  applyLocale('it')
})

/** The Worker has Google's credentials, and Drive answers. */
function configureGoogle() {
  const drive = createFakeDrive()
  vi.stubGlobal('fetch', fakeDriveFetch(drive))
  return drive
}

describe('settingsView', () => {
  it('offers automatic, Italian and English', () => {
    const wrapper = mountSettings()
    const labels = wrapper.get('[aria-labelledby="settings-language"]').findAll('button').map(button => button.text())
    expect(labels).toEqual(['Automatica', 'Italiano', 'English'])
    expect(pressedLabel(wrapper)).toEqual(['Automatica'])
  })

  it('opens the categories, counting those in the quick add', async () => {
    const [groceries] = await listCategories({ kind: 'expense' })
    await archiveCategory(groceries!.id)
    const wrapper = mountSettings()
    const row = wrapper.get('[aria-labelledby="settings-categories"] a')
    expect(row.attributes('href')).toBe('/impostazioni/categorie')
    await vi.waitFor(() => expect(row.text()).toContain('11 uscite · 4 entrate'), { timeout: 5000 })
  })

  it('tells when the last backup was made', async () => {
    const wrapper = mountSettings()
    const backup = wrapper.get('[aria-labelledby="settings-backup"]')
    await vi.waitFor(() => expect(backup.text()).toContain('ultimo: mai'), { timeout: 5000 })
    expect(backup.findAll('.settings-row').map(row => row.text())).toEqual([
      'Esporta backupFile JSON con tutti i dati',
      'Esporta movimentiFile CSV per un foglio di calcolo',
      'Importa backupSostituisce i dati di questo telefono',
    ])

    await setMeta('lastExportAt', new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
    await vi.waitFor(() => expect(backup.text()).toContain('ultimo: 3 giorni fa'), { timeout: 5000 })
  })

  it('shows the app version', () => {
    const wrapper = mountSettings()
    const about = wrapper.get('[aria-labelledby="settings-about"]')
    expect(about.text()).toContain(`Versione ${__APP_VERSION__}`)
  })

  it('switches the language and remembers it', async () => {
    const wrapper = mountSettings()
    const english = wrapper.findAll('button').find(button => button.text() === 'English')
    await english?.trigger('click')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Settings')
    expect(pressedLabel(wrapper)).toEqual(['English'])
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
  })

  it('links the privacy page', () => {
    const wrapper = mountSettings()
    const privacy = wrapper.get('[aria-labelledby="settings-about"] a')
    expect(privacy.attributes('href')).toBe('/privacy')
    expect(privacy.text()).toContain('Privacy')
  })
})

describe('automatic backup in the settings', () => {
  function driveSection(wrapper: ReturnType<typeof mountSettings>) {
    return wrapper.find('[aria-labelledby="settings-drive"]')
  }

  it('stays hidden where Google is not configured', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(driveSection(wrapper).exists()).toBe(false)
    expect(wrapper.get('#settings-backup').text()).toBe('Backup su file')
  })

  it('offers to connect Google Drive where it is configured', async () => {
    configureGoogle()
    const wrapper = mountSettings()
    await vi.waitFor(() => expect(driveSection(wrapper).exists()).toBe(true))
    expect(driveSection(wrapper).text()).toContain('Google DriveCollega il tuo account: il backup parte da solo')
  })

  it('shows when the last backup went and opens the Drive sheet', async () => {
    configureGoogle()
    patchBackupState({
      connected: true,
      account: 'anna@example.com',
      lastBackupAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    })
    const wrapper = mountSettings()
    const row = driveSection(wrapper).get('.settings-row')
    expect(row.text()).toContain('Automatico · ultimo: 2 minuti fa')
    expect(row.find('.settings-row__detail--alert').exists()).toBe(false)

    await row.trigger('click')
    await flushPromises()
    const sheet = wrapper.get('dialog[open]')
    expect(sheet.text()).toContain('anna@example.com')
    expect(sheet.findAll('button').map(button => button.text())).toEqual(expect.arrayContaining([
      'Esegui backup ora',
      'Ripristina da Drive',
      'Scollega Google Drive',
    ]))
  })

  it('asks to reconnect when the permission expired', async () => {
    patchBackupState({ connected: true, error: 'auth' })
    const wrapper = mountSettings()
    const row = driveSection(wrapper).get('.settings-row')
    expect(row.get('.settings-row__detail--alert').text()).toBe('Da ricollegare')
    await row.trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog[open]').text()).toContain('Ricollega Google Drive')
  })
})
