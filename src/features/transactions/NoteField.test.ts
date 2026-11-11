import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { addTransaction } from '@/db/repositories/transactions'
import { testPlugins } from '@/test/plugins'
import NoteField from './NoteField.vue'

let wrapper: VueWrapper | undefined

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  const base = {
    kind: 'expense' as const,
    amountCents: 500,
    accountId: 'cash',
    categoryId: 'groceries',
  }
  await addTransaction({ ...base, date: '2026-11-01', note: 'Esselunga' })
  await addTransaction({ ...base, date: '2026-11-02', note: 'Bar' })
  await addTransaction({ ...base, date: '2026-11-03', note: 'esselunga' })
  await addTransaction({
    ...base,
    kind: 'income',
    categoryId: 'salary',
    date: '2026-11-04',
    note: 'Stipendio',
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mountField(note = '') {
  wrapper = mount(NoteField, {
    props: {
      note,
      'kind': 'expense',
      'onUpdate:note': (value: string) => wrapper!.setProps({ note: value }),
      'onUpdate:editing': (value: boolean) => wrapper!.setProps({ editing: value }),
    },
    attachTo: document.body,
    global: {
      plugins: testPlugins(),
    },
  })
  return wrapper
}

/** Taps the button and waits for the frequent notes, which are read from the database. */
async function open(field: VueWrapper) {
  await field.find('.action-chip').trigger('click')
  await vi.waitFor(() => expect(field.findAll('.note-field__suggestion').length).toBeGreaterThan(0))
}

/** The note and whether the field is open, as the parent sees them. */
function state(field: VueWrapper) {
  return field.props() as { note: string, editing?: boolean }
}

function suggestions(field: VueWrapper) {
  return field.findAll('.note-field__suggestion').map(item => item.text())
}

describe('noteField', () => {
  it('is a small button at rest, with the note when there is one', () => {
    expect(mountField().find('.action-chip').text()).toBe('Nota')
    wrapper!.unmount()
    const chip = mountField('Esselunga').find('.action-chip')
    expect(chip.text()).toBe('Esselunga')
    expect(chip.attributes('aria-label')).toBe('Nota: Esselunga')
  })

  it('opens the field in its place, with the frequent notes of that kind', async () => {
    const field = mountField()
    await open(field)
    expect(document.activeElement).toBe(field.find('input').element)
    expect(field.emitted('update:editing')).toEqual([
      [true],
    ])
    expect(field.find('.action-chip').exists()).toBe(false)
    // «Esselunga» twice, as last written; the income's note is not among them.
    expect(suggestions(field)).toEqual(['esselunga', 'Bar'])
    expect(field.find('[role="group"]').attributes('aria-label')).toBe('Note frequenti')
  })

  it('keeps what is typed as the note, on one line, and filters the frequent notes', async () => {
    const field = mountField()
    await open(field)
    await field.find('input').setValue('  ba  ')
    expect(state(field).note).toBe('ba')
    expect(suggestions(field)).toEqual(['Bar'])
    await field.find('input').setValue('Pane  e   latte')
    expect(state(field).note).toBe('Pane e latte')
    expect(suggestions(field)).toEqual([])

    await field.find('input').trigger('keydown', { key: 'Enter' })
    expect(state(field).editing).toBe(false)
    expect(field.find('.action-chip').text()).toBe('Pane e latte')
  })

  it('writes a frequent note with one tap and closes', async () => {
    const field = mountField()
    await open(field)
    await field.findAll('.note-field__suggestion')[1]!.trigger('click')
    expect(state(field).note).toBe('Bar')
    expect(state(field).editing).toBe(false)
    expect(field.find('.action-chip').text()).toBe('Bar')
  })

  it('empties the note with the clear button, and stays open', async () => {
    const field = mountField('Bar')
    await field.find('.action-chip').trigger('click')
    await flushPromises()
    const clear = field.find('.note-field__clear')
    expect(clear.attributes('aria-label')).toBe('Svuota la nota')
    await clear.trigger('click')
    expect(state(field).note).toBe('')
    expect(state(field).editing).toBe(true)
    expect(field.find('.note-field__clear').exists()).toBe(false)
  })
})
