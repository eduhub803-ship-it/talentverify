/**
 * Dependency-free spreadsheet parsing for the bulk candidate import.
 * Supports CSV/TSV text files and XLSX workbooks (ZIP + inflate through the
 * platform DecompressionStream, no third-party library).
 */

export interface ParsedSheet {
  fileName: string
  sheetName: string
  headers: string[]
  /** Data rows, padded/trimmed to `headers` length. */
  rows: string[][]
}

const CSV_DELIMITERS = [',', ';', '\t', '|'] as const

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Picks the delimiter that yields the most columns on the header line. */
export function detectDelimiter(text: string): string {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? ''
  let best = ','
  let bestCount = 0
  for (const delimiter of CSV_DELIMITERS) {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < firstLine.length; i += 1) {
      const char = firstLine[i]
      if (char === '"') {
        if (inQuotes && firstLine[i + 1] === '"') i += 1
        else inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        count += 1
      }
    }
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/** RFC 4180 style reader that tolerates CRLF, quotes and embedded newlines. */
export function parseDelimitedText(input: string, delimiter?: string): string[][] {
  const text = stripBom(input)
  const sep = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let hasContent = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    if (hasContent) rows.push(row)
    row = []
    hasContent = false
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      hasContent = true
      continue
    }

    if (char === '"') {
      inQuotes = true
      hasContent = true
      continue
    }
    if (char === sep) {
      endField()
      continue
    }
    if (char === '\r') continue
    if (char === '\n') {
      endRow()
      continue
    }
    field += char
    if (char.trim()) hasContent = true
  }

  if (field.length > 0 || row.length > 0) endRow()
  return rows
}

/* ------------------------------------------------------------------ */
/* XLSX                                                                */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string
  bytes: Uint8Array
}

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const Decompressor = (
    globalThis as { DecompressionStream?: typeof DecompressionStream }
  ).DecompressionStream
  if (!Decompressor) {
    throw new Error(
      'This browser cannot read XLSX files. Please save the file as CSV and import again.',
    )
  }
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new Decompressor('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

/** Minimal ZIP reader driven by the end-of-central-directory record. */
async function readZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i -= 1) {
    if (readU32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('The selected file is not a valid XLSX workbook.')

  const entryCount = readU16(view, eocd + 10)
  let pointer = readU32(view, eocd + 16)
  const decoder = new TextDecoder('utf-8')
  const entries: ZipEntry[] = []

  for (let index = 0; index < entryCount; index += 1) {
    if (readU32(view, pointer) !== 0x02014b50) break
    const method = readU16(view, pointer + 10)
    const compressedSize = readU32(view, pointer + 20)
    const nameLength = readU16(view, pointer + 28)
    const extraLength = readU16(view, pointer + 30)
    const commentLength = readU16(view, pointer + 32)
    const localOffset = readU32(view, pointer + 42)
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))
    pointer += 46 + nameLength + extraLength + commentLength

    if (!/^xl\/(worksheets\/|sharedStrings|styles|workbook)/.test(name)) continue
    if (readU32(view, localOffset) !== 0x04034b50) continue

    const localNameLength = readU16(view, localOffset + 26)
    const localExtraLength = readU16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = bytes.subarray(dataStart, dataStart + compressedSize)

    entries.push({ name, bytes: method === 0 ? raw : await inflateRaw(raw) })
  }

  return entries
}

function xmlText(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
}

function parseSharedStrings(xml: string): string[] {
  const result: string[] = []
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let match: RegExpExecArray | null
  while ((match = siRegex.exec(xml))) {
    const runs = match[1].match(/<t\b[^>]*>[\s\S]*?<\/t>/g)
    result.push(runs ? runs.map(xmlText).join('') : '')
  }
  return result
}

/** Style indexes whose number format renders as a date. */
function parseDateStyles(xml: string): Set<number> {
  const dateStyles = new Set<number>()
  const customDateFormats = new Set<number>()

  const numFmtRegex = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = numFmtRegex.exec(xml))) {
    const code = match[2].toLowerCase().replace(/\[[^\]]*\]/g, '')
    if (code !== 'general' && /[dmy]/.test(code)) {
      customDateFormats.add(Number(match[1]))
    }
  }

  const cellXfsBlock = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!cellXfsBlock) return dateStyles

  const xfs = cellXfsBlock[1].match(/<xf\b[^>]*?\/?>/g) ?? []
  xfs.forEach((xf, index) => {
    const id = Number(xf.match(/numFmtId="(\d+)"/)?.[1] ?? 0)
    const builtInDate = (id >= 14 && id <= 22) || (id >= 45 && id <= 47)
    if (builtInDate || customDateFormats.has(id)) dateStyles.add(index)
  })
  return dateStyles
}

function excelSerialToIso(serial: number): string {
  // Excel day 0 is 1899-12-30 (accounting for the 1900 leap-year bug).
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
  if (Number.isNaN(date.getTime())) return String(serial)
  return date.toISOString().slice(0, 10)
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index - 1
}

function parseWorksheet(
  xml: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
): string[][] {
  const rows: string[][] = []
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(xml))) {
    const cells: string[] = []
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      const attrs = cellMatch[1]
      const body = cellMatch[2] ?? ''
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1]
      const type = attrs.match(/t="([^"]+)"/)?.[1] ?? 'n'
      const styleIndex = Number(attrs.match(/s="(\d+)"/)?.[1] ?? -1)
      const target = ref ? columnIndexFromRef(ref) : cells.length

      let value: string
      if (type === 's') {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        value = raw ? (sharedStrings[Number(raw)] ?? '') : ''
      } else if (type === 'inlineStr' || type === 'str') {
        const runs = body.match(/<t\b[^>]*>[\s\S]*?<\/t>/g)
        value = runs ? runs.map(xmlText).join('') : xmlText(body)
      } else if (type === 'b') {
        value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] === '1' ? 'TRUE' : 'FALSE'
      } else {
        const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
        value = xmlText(raw)
        if (value && dateStyles.has(styleIndex) && !Number.isNaN(Number(value))) {
          value = excelSerialToIso(Number(value))
        }
      }

      while (cells.length < target) cells.push('')
      cells[target] = value
    }

    rows.push(cells)
  }

  return rows.filter((row) => row.some((cell) => cell.trim()))
}

export async function parseXlsxWorkbook(
  buffer: ArrayBuffer,
): Promise<{ sheetName: string; rows: string[][] }> {
  const entries = await readZipEntries(buffer)
  const decoder = new TextDecoder('utf-8')
  const read = (name: string) => {
    const entry = entries.find((item) => item.name === name)
    return entry ? decoder.decode(entry.bytes) : ''
  }

  const sheetEntries = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
  if (sheetEntries.length === 0) {
    throw new Error('The workbook does not contain any sheets.')
  }

  const sharedStrings = parseSharedStrings(read('xl/sharedStrings.xml'))
  const dateStyles = parseDateStyles(read('xl/styles.xml'))
  const sheetName = read('xl/workbook.xml').match(/<sheet\b[^>]*name="([^"]*)"/)?.[1]

  return {
    sheetName: sheetName ?? 'Sheet1',
    rows: parseWorksheet(decoder.decode(sheetEntries[0].bytes), sharedStrings, dateStyles),
  }
}

export function buildParsedSheet(
  fileName: string,
  sheetName: string,
  table: string[][],
): ParsedSheet {
  const [headerRow = [], ...dataRows] = table
  const headers = headerRow.map((header) => header.trim())
  const width = headers.length
  return {
    fileName,
    sheetName,
    headers,
    rows: dataRows
      .map((row) => Array.from({ length: width }, (_, index) => (row[index] ?? '').trim()))
      .filter((row) => row.some((cell) => cell.length > 0)),
  }
}

export function isSupportedImportFile(fileName: string): boolean {
  return /\.(csv|tsv|txt|xlsx)$/i.test(fileName.trim())
}

export async function parseImportFile(file: File): Promise<ParsedSheet> {
  if (!isSupportedImportFile(file.name)) {
    throw new Error('Unsupported file type. Please upload a CSV or XLSX file.')
  }

  if (/\.xlsx$/i.test(file.name)) {
    const { sheetName, rows } = await parseXlsxWorkbook(await file.arrayBuffer())
    return buildParsedSheet(file.name, sheetName, rows)
  }

  const text = await file.text()
  return buildParsedSheet(file.name, 'CSV', parseDelimitedText(text))
}
