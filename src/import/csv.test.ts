import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, readCsv } from './csv'
import { decodeText } from './text'

describe('parseCsv', () => {
  it('keeps separators and quotes inside quoted cells', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;2;3', ';')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ])
  })

  it('reads a quoted cell over two lines', () => {
    expect(parseCsv('"one\ntwo",3\n', ',')).toEqual([
      ['one\ntwo', '3'],
    ])
  })
})

describe('detectDelimiter', () => {
  it('finds the separator of the table, not of the preamble', () => {
    expect(detectDelimiter('Conto, 1000\nData;Descrizione;Importo\n01/03/2026;Bar, centro;-1,20\n02/03/2026;Esselunga;-45,90')).toBe(';')
    expect(detectDelimiter('"Date","Description","Amount"\n"2026-03-01","Bar","-1,20"')).toBe(',')
    expect(detectDelimiter('Date\tDescription\tAmount\n2026-03-01\tBar\t-1.20')).toBe('\t')
  })
})

describe('readCsv', () => {
  it('trims the cells and drops the empty lines', () => {
    expect(readCsv(' a ; b \n\n;\n1;2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('decodeText', () => {
  it('reads UTF-8, with or without its mark', () => {
    expect(decodeText(new TextEncoder().encode('Caffè'))).toBe('Caffè')
    expect(decodeText(new Uint8Array([0xEF, 0xBB, 0xBF, 0x61]))).toBe('a')
  })

  it('reads Windows-1252 when the bytes are not UTF-8', () => {
    expect(decodeText(new Uint8Array([0x43, 0x61, 0x66, 0x66, 0xE8]))).toBe('Caffè')
  })
})
