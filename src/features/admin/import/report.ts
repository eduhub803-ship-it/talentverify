/**
 * Downloadable artefacts for the bulk candidate import: the blank template and
 * the error report that lets staff fix rejected rows and re-run the file.
 */
import { IMPORT_FIELDS, toCsv } from './fields'
import type { ColumnMapping } from './fields'
import type { ParsedSheet } from './parse'
import { rejectedRows, rowIssueText, type ValidatedRow } from './validate'

const STATUS_LABELS: Record<ValidatedRow['status'], string> = {
  valid: 'Valid',
  error: 'Error',
  duplicate_in_file: 'Duplicate in file',
  existing_candidate: 'Already on the platform',
  conflict: 'Conflict',
}

export function importStatusLabel(status: ValidatedRow['status']): string {
  return STATUS_LABELS[status]
}

/**
 * Error report keeps the original spreadsheet columns so the file can be fixed
 * and re-imported directly, with two extra diagnostic columns in front.
 */
export function buildErrorReportCsv(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  rows: ValidatedRow[],
): string {
  const rejected = rejectedRows(rows)
  const header = ['Row', 'Import status', 'Problem', ...sheet.headers]
  const body = rejected.map((row) => {
    const original = sheet.rows[row.rowNumber - 2] ?? []
    return [
      String(row.rowNumber),
      STATUS_LABELS[row.status],
      rowIssueText(row),
      ...sheet.headers.map((_, index) => original[index] ?? ''),
    ]
  })

  if (mapping.every((key) => key === null)) {
    return toCsv([header])
  }
  return toCsv([header, ...body])
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(fileName: string, content: string) {
  downloadTextFile(fileName, content, 'text/csv')
}

/** Column reference sheet shown in the UI help panel. */
export const IMPORT_FIELD_REFERENCE = IMPORT_FIELDS.map((field) => ({
  key: field.key,
  label: field.label,
  labelAr: field.labelAr,
  required: field.required,
  hint: field.hint,
  hintAr: field.hintAr,
  example: field.example,
}))
