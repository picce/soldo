import { describe, expect, it } from 'vitest'
import { isCamt, readCamt } from './camt'
import { buildStatementXlsx, buildZip } from './fixtures/build-xlsx'
import { fixtureText } from './fixtures/files'
import { isOfx, readOfx } from './ofx'
import { isQif, readQif } from './qif'
import { readXlsx } from './xlsx'
import { readZip } from './zip'

describe('oFX', () => {
  it('reads version 1, with the tags left open', () => {
    const text = fixtureText('estratto-1.ofx')
    expect(isOfx(text)).toBe(true)
    expect(readOfx(text)).toEqual([
      {
        line: 1,
        date: '2026-03-02',
        amountCents: -4590,
        description: 'ESSELUNGA MILANO Pagamento POS',
      },
      {
        line: 2,
        date: '2026-03-05',
        amountCents: 185000,
        description: 'ACME SRL & FIGLI',
      },
    ])
  })

  it('reads version 2, in XML', () => {
    expect(readOfx(fixtureText('estratto-2.ofx'))).toEqual([
      {
        line: 1,
        date: '2026-03-10',
        amountCents: -1299,
        description: 'NETFLIX.COM',
      },
    ])
  })
})

describe('qIF', () => {
  it('reads payee and memo, with the dates of the file', () => {
    const text = fixtureText('estratto.qif')
    expect(isQif(text)).toBe(true)
    expect(readQif(text)).toEqual([
      {
        line: 1,
        date: '2026-03-02',
        amountCents: -4590,
        description: 'ESSELUNGA MILANO Pagamento POS',
      },
      {
        line: 2,
        date: '2026-03-05',
        amountCents: 185000,
        description: 'ACME SRL',
      },
      {
        line: 3,
        date: '2026-03-13',
        amountCents: -120,
        description: 'Bar Sport',
      },
    ])
  })
})

describe('cAMT.053', () => {
  it('reads the booked entries, money out for DBIT', () => {
    const text = fixtureText('estratto-camt053.xml')
    expect(isCamt(text)).toBe(true)
    expect(readCamt(text)).toEqual([
      {
        line: 1,
        date: '2026-03-02',
        amountCents: -4590,
        description: 'ESSELUNGA SPA Spesa Milano',
      },
      {
        line: 2,
        date: '2026-03-05',
        amountCents: 185000,
        description: 'ACME SRL Stipendio marzo',
      },
      {
        line: 4,
        date: '2026-03-20',
        amountCents: -200,
        description: 'Commissioni',
      },
    ])
  })

  it('gives up on broken XML', () => {
    expect(readCamt('<Document><BkToCstmrStmt>')).toBeNull()
  })
})

describe('excel', () => {
  it.each([true, false])('reads the first sheet (compressed: %s)', async (compress) => {
    expect(await readXlsx(await buildStatementXlsx(compress))).toEqual([
      ['Movimenti conto'],
      ['Data', 'Descrizione', 'Importo'],
      ['2026-03-02', 'ESSELUNGA MILANO', -45.9],
      ['2026-03-05', 'ACME SRL stipendio', 1850],
      [null, 'Totale', 1804.1],
    ])
  })

  it('lists the files of a zip', async () => {
    const zip = readZip(await buildZip({ 'a.txt': 'hello', 'b/c.txt': 'world' }))
    expect([
      ...zip.keys(),
    ]).toEqual(['a.txt', 'b/c.txt'])
    expect(new TextDecoder().decode(await zip.get('b/c.txt')!.read())).toBe('world')
  })

  it('refuses a zip that is not a workbook', async () => {
    await expect(readXlsx(await buildZip({ 'a.txt': 'hello' }))).rejects.toThrow()
  })
})
