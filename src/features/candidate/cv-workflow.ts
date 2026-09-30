import type { DocumentType, TalentDocument } from '@/types/domain'

export const CV_MAX_SIZE_MB = 10
export const CV_MAX_SIZE_BYTES = CV_MAX_SIZE_MB * 1024 * 1024

// TalentVerify ships exactly one official candidate CV template: English, ATS-friendly.
export const CV_TEMPLATE = {
  language: 'English',
  titleKey: 'uploadCv.templateTitle',
  descriptionKey: 'uploadCv.templateDescription',
  labelKey: 'uploadCv.downloadTemplate',
  href: '/templates/talentverify-cv-template.docx',
  filename: 'talentverify-cv-template.docx',
} as const

const CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const CV_EXTENSIONS = new Set(['pdf', 'doc', 'docx'])

export interface CandidateFileLike {
  name: string
  size: number
  type?: string
}

export interface FileValidationResult {
  ok: boolean
  message: string | null
}

export function getFileExtension(fileName: string): string {
  const cleanName = fileName.trim().toLowerCase()
  const dot = cleanName.lastIndexOf('.')
  return dot >= 0 ? cleanName.slice(dot + 1) : ''
}

export function getDocumentFileType(document: Pick<TalentDocument, 'fileName' | 'mimeType'>): string {
  const extension = getFileExtension(document.fileName)
  if (extension) return extension.toUpperCase()
  if (document.mimeType === 'application/pdf') return 'PDF'
  if (document.mimeType?.includes('word')) return 'DOCX'
  return 'Unknown'
}

export function validateCvFile(file: CandidateFileLike): FileValidationResult {
  if (file.size > CV_MAX_SIZE_BYTES) {
    return { ok: false, message: `File must be under ${CV_MAX_SIZE_MB}MB` }
  }

  const extension = getFileExtension(file.name)
  const hasAllowedExtension = CV_EXTENSIONS.has(extension)
  const hasAllowedMime = file.type ? CV_MIME_TYPES.has(file.type) : true

  if (!hasAllowedExtension || !hasAllowedMime) {
    return { ok: false, message: 'Upload a PDF, DOC, or DOCX file.' }
  }

  return { ok: true, message: null }
}

export function sanitizeStorageFileName(fileName: string): string {
  const fallback = 'document'
  const baseName = fileName
    .trim()
    .split(/[/\\]/)
    .filter(Boolean)
    .pop() ?? fallback

  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._ -]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 140)

  return sanitized || fallback
}

export function buildCandidateDocumentPath(
  userId: string,
  type: DocumentType,
  fileName: string,
  timestamp = Date.now(),
): string {
  const safeFileName = sanitizeStorageFileName(fileName)
  return `${userId}/${type}/${timestamp}-${safeFileName}`
}

export function getActiveCvDocument(
  documents: readonly TalentDocument[],
): TalentDocument | null {
  return [...documents]
    .filter((document) => document.type === 'cv')
    .sort((a, b) => {
      const byDate =
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      return byDate || b.id.localeCompare(a.id)
    })[0] ?? null
}

export function getPreviousCvDocuments(
  documents: readonly TalentDocument[],
): TalentDocument[] {
  const active = getActiveCvDocument(documents)
  return [...documents]
    .filter((document) => document.type === 'cv' && document.id !== active?.id)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    )
}
