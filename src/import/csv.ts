/**
 * CSV files of the banks (docs/specs/released/import-da-file.md): any separator among `;` `,` tab and
 * `|`, quoted cells with `""` inside, lines ending in `\n` or `\r\n`.
 */

const DELIMITERS = [';', ',', '\t', '|'] as const

/** Cells of every line, as written; empty lines are kept as `['']`. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index++
        }
        else {
          quoted = false
        }
      }
      else {
        cell += char
      }
    }
    else if (char === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    }
    else if (char === delimiter) {
      row.push(cell)
      cell = ''
    }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n')
        index++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    }
    else {
      cell += char
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/**
 * The separator that gives the same number of cells (more than one) to the most lines, among
 * the first hundred: a preamble or a total of a few lines does not change it.
 */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 100).join('\n')
  let best: { delimiter: string, score: number } = { delimiter: DELIMITERS[0], score: -1 }
  for (const delimiter of DELIMITERS) {
    const counts = new Map<number, number>()
    for (const row of parseCsv(sample, delimiter)) {
      if (row.length > 1)
        counts.set(row.length, (counts.get(row.length) ?? 0) + 1)
    }
    let score = 0
    for (const [width, lines] of counts)
      score = Math.max(score, lines * 1000 + width)
    if (score > best.score)
      best = { delimiter, score }
  }
  return best.delimiter
}

/** The cells of a CSV, trimmed, without the empty lines. */
export function readCsv(text: string): string[][] {
  return parseCsv(text, detectDelimiter(text))
    .map(row => row.map(cell => cell.trim()))
    .filter(row => row.some(cell => cell !== ''))
}
