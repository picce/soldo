import type { Cell } from './types'
import { toIsoDate } from '@/domain/dates'
import { children, elements, parseXml } from './xml'
import { readZip, ZipError } from './zip'

/**
 * The first sheet of an Excel `.xlsx` (docs/specs/released/import-da-file.md), as rows of cells: text,
 * numbers, and the cells formatted as dates turned into `YYYY-MM-DD`.
 */

/** Built-in Excel number formats that are dates (with or without the time). */
const DATE_FORMAT_IDS = new Set([
  14,
  15,
  16,
  17,
  22,
  27,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  50,
  51,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
])

function isDateCode(code: string): boolean {
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '')
  return /[dy]/i.test(bare)
}

/** Column of a reference such as `AB12`, from 0. */
function columnOf(reference: string): number {
  let column = 0
  for (const char of reference.toUpperCase()) {
    if (char < 'A' || char > 'Z')
      break
    column = column * 26 + char.charCodeAt(0) - 64
  }
  return column - 1
}

function excelDateToIso(serial: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
  return toIsoDate(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** `xl/worksheets/sheet1.xml` from a target of the workbook's relationships. */
function resolveTarget(target: string): string {
  if (target.startsWith('/'))
    return target.slice(1)
  return `xl/${target}`.replace(/\/[^/]+\/\.\.\//g, '/')
}

/** The cells of the first sheet; throws when the file is not a readable workbook. */
export async function readXlsx(bytes: Uint8Array<ArrayBuffer>): Promise<Cell[][]> {
  const zip = readZip(bytes)
  const xml = async (name: string) => {
    const entry = zip.get(name)
    return entry
      ? parseXml(new TextDecoder().decode(await entry.read()))
      : null
  }

  const workbook = await xml('xl/workbook.xml')
  const firstSheet = workbook && elements(workbook, 'sheet')[0]
  if (!firstSheet)
    throw new ZipError('No sheet')
  const relationId = firstSheet.getAttribute('r:id')
    ?? Array.from(firstSheet.attributes).find(attribute => attribute.localName === 'id')?.value
  const relations = await xml('xl/_rels/workbook.xml.rels')
  const target = relations && elements(relations, 'Relationship')
    .find(relation => relation.getAttribute('Id') === relationId)
    ?.getAttribute('Target')
  const sheet = await xml(target
    ? resolveTarget(target)
    : 'xl/worksheets/sheet1.xml')
  if (!sheet)
    throw new ZipError('No sheet')

  const strings = await xml('xl/sharedStrings.xml')
  const shared = strings
    ? elements(strings, 'si').map(item => elements(item, 't').map(node => node.textContent ?? '').join(''))
    : []

  // Which styles are dates: the number format of each cell style.
  const styles = await xml('xl/styles.xml')
  const dateStyles = new Set<number>()
  if (styles) {
    const custom = new Map(elements(styles, 'numFmt').map(format => [
      Number(format.getAttribute('numFmtId')),
      format.getAttribute('formatCode') ?? '',
    ]))
    const cellXfs = elements(styles, 'cellXfs')[0]
    const formats = cellXfs
      ? children(cellXfs, 'xf')
      : []
    formats.forEach((format, index) => {
      const id = Number(format.getAttribute('numFmtId') ?? 0)
      const code = custom.get(id)
      if (code !== undefined
        ? isDateCode(code)
        : DATE_FORMAT_IDS.has(id)) {
        dateStyles.add(index)
      }
    })
  }

  const rows: Cell[][] = []
  for (const row of elements(sheet, 'row')) {
    const cells: Cell[] = []
    for (const cell of children(row, 'c')) {
      const reference = cell.getAttribute('r')
      const column = reference
        ? columnOf(reference)
        : cells.length
      const type = cell.getAttribute('t')
      const raw = children(cell, 'v')[0]?.textContent ?? null
      let value: Cell = null
      if (type === 's' && raw !== null) {
        value = shared[Number(raw)] ?? null
      }
      else if (type === 'inlineStr') {
        value = elements(cell, 't').map(node => node.textContent ?? '').join('')
      }
      else if ((type === 'str' || type === 'e') && raw !== null) {
        value = raw
      }
      else if (type === 'b' && raw !== null) {
        value = raw === '1'
          ? 'TRUE'
          : 'FALSE'
      }
      else if (raw !== null && raw !== '') {
        const number = Number(raw)
        value = Number.isFinite(number)
          ? dateStyles.has(Number(cell.getAttribute('s') ?? -1))
            ? excelDateToIso(number)
            : number
          : raw
      }
      if (typeof value === 'string')
        value = value.trim() || null
      while (cells.length < column)
        cells.push(null)
      cells[column] = value
    }
    if (cells.some(cell => cell !== null))
      rows.push(cells)
  }
  return rows
}
