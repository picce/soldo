import { describe, expect, it } from 'vitest'
import { buildStatementXlsx, buildZip } from './fixtures/build-xlsx'
import { fixtureBytes } from './fixtures/files'
import { readStatementBytes } from './read'

const text = (content: string) => new TextEncoder().encode(content)

describe('readStatementBytes', () => {
  it('opens a CSV as a sheet to map', async () => {
    const reading = await readStatementBytes(fixtureBytes('banca-dare-avere.csv'), 'marzo.csv')
    expect(reading.ok && reading.statement.kind === 'sheet' && reading.statement.format).toBe('csv')
  })

  it('opens an Excel workbook as a sheet', async () => {
    const reading = await readStatementBytes(await buildStatementXlsx(), 'marzo.xlsx')
    expect(reading.ok && reading.statement.format).toBe('xlsx')
  })

  it.each([
    ['estratto-1.ofx', 'ofx', 2],
    ['estratto.qif', 'qif', 3],
    ['estratto-camt053.xml', 'camt', 3],
  ])('reads the movements of %s', async (name, format, count) => {
    const reading = await readStatementBytes(fixtureBytes(name), name)
    expect(reading.ok && reading.statement.kind === 'rows' && [reading.statement.format, reading.statement.rows.length]).toEqual([format, count])
  })

  it('says what it cannot read', async () => {
    expect(await readStatementBytes(new Uint8Array(0), 'a.csv')).toEqual({ ok: false, error: 'empty' })
    expect(await readStatementBytes(text('  \n'), 'a.csv')).toEqual({ ok: false, error: 'empty' })
    expect(await readStatementBytes(text('%PDF-1.7'), 'a.pdf')).toEqual({ ok: false, error: 'unsupported' })
    expect(await readStatementBytes(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0]), 'a.xls')).toEqual({ ok: false, error: 'unsupported' })
    expect(await readStatementBytes(await buildZip({ 'a.txt': 'x' }), 'a.zip')).toEqual({ ok: false, error: 'unsupported' })
    expect(await readStatementBytes(text('<html><body></body></html>'), 'a.html')).toEqual({ ok: false, error: 'unsupported' })
    expect(await readStatementBytes(text('<?xml version="1.0"?><Document xmlns="camt.053"><BkToCstmrStmt>'), 'a.xml')).toEqual({ ok: false, error: 'unreadable' })
    expect(await readStatementBytes(text('!Type:Bank\n^\n'), 'a.qif')).toEqual({ ok: false, error: 'empty' })
  })
})
