import { transform } from '@/backup/pack'

/**
 * Builds a small `.xlsx` for the tests (docs/specs/released/import-da-file.md): shared strings, a
 * number, a date styled as a date; files stored or compressed, as Excel does.
 */

const encoder = new TextEncoder()

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export async function buildZip(files: Record<string, string>, compress = true): Promise<Uint8Array<ArrayBuffer>> {
  const locals: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const raw = encoder.encode(content)
    const data = compress
      ? await transform(raw, new CompressionStream('deflate-raw'))
      : raw
    const nameBytes = encoder.encode(name)
    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034B50, true)
    localView.setUint16(8, compress ? 8 : 0, true)
    localView.setUint32(14, crc32(raw), true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, raw.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    const entry = new Uint8Array(46 + nameBytes.length)
    const entryView = new DataView(entry.buffer)
    entryView.setUint32(0, 0x02014B50, true)
    entryView.setUint16(10, compress ? 8 : 0, true)
    entryView.setUint32(16, crc32(raw), true)
    entryView.setUint32(20, data.length, true)
    entryView.setUint32(24, raw.length, true)
    entryView.setUint16(28, nameBytes.length, true)
    entryView.setUint32(42, offset, true)
    entry.set(nameBytes, 46)
    locals.push(local, data)
    directory.push(entry)
    offset += local.length + data.length
  }
  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054B50, true)
  endView.setUint16(8, directory.length, true)
  endView.setUint16(10, directory.length, true)
  endView.setUint32(12, directorySize, true)
  endView.setUint32(16, offset, true)
  const parts = [
    ...locals,
    ...directory,
    end,
  ]
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let position = 0
  for (const part of parts) {
    out.set(part, position)
    position += part.length
  }
  return out
}

/** A statement with a title row, the column names, two movements and a total. */
export function buildStatementXlsx(compress = true): Promise<Uint8Array<ArrayBuffer>> {
  const strings = [
    'Movimenti conto',
    'Data',
    'Descrizione',
    'Importo',
    'ESSELUNGA MILANO',
    'ACME SRL',
    'Totale',
  ]
  return buildZip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimenti" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map(text => `<si><t>${text}</t></si>`).join('')}</sst>`,
    'xl/styles.xml': `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c></row>
<row r="4"><c r="A4" s="1"><v>46083</v></c><c r="B4" t="s"><v>4</v></c><c r="C4" s="2"><v>-45.9</v></c></row>
<row r="5"><c r="A5" s="1"><v>46086</v></c><c r="B5" t="inlineStr"><is><t>ACME SRL stipendio</t></is></c><c r="C5" s="2"><v>1850</v></c></row>
<row r="7"><c r="B7" t="s"><v>6</v></c><c r="C7"><v>1804.1</v></c></row>
</sheetData></worksheet>`,
  }, compress)
}
