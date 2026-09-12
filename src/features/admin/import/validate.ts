/**
 * Row validation, duplicate detection and conflict detection for the bulk
 * candidate import. Pure: the same result drives the preview UI and the
 * persistence step, in both the mock and Supabase backends.
 */
import type {
  CandidateDirectoryEntry,
  ImportedCandidateData,
} from '@/types/domain'
import type { ColumnMapping, ImportFieldKey } from './fields'
import { IMPORT_FIELD_BY_KEY } from './fields'
import type { ParsedSheet } from './parse'
import {
  cleanText,
  isValidEmail,
  normalizeDate,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseAvailabilityTiming,
  parseBoolean,
  parseEducation,
  parseExperience,
  parseLanguages,
  parseRemotePreference,
  parseStructuredSkills,
  parseTraining,
  splitList,
  textOrNull,
  type IdFactory,
} from './normalize'

export type ImportRowStatus =
  | 'valid'
  | 'error'
  | 'duplicate_in_file'
  | 'existing_candidate'
  | 'conflict'

export type IssueSeverity = 'error' | 'warning'

export interface RowIssue {
  field: ImportFieldKey | 'row'
  severity: IssueSeverity
  message: string
  messageAr: string
}

export interface FieldDifference {
  field: string
  existing: string
  incoming: string
}

export interface RowMatch {
  source: CandidateDirectoryEntry['source']
  id: string
  fullName: string | null
  differences: FieldDifference[]
}

export interface ValidatedRow {
  /** 1-based spreadsheet row number, header row included. */
  rowNumber: number
  values: Record<string, string>
  data: ImportedCandidateData | null
  status: ImportRowStatus
  issues: RowIssue[]
  match: RowMatch | null
}

export interface ValidationSummary {
  total: number
  valid: number
  errors: number
  duplicatesInFile: number
  existingCandidates: number
  conflicts: number
  warnings: number
}

export interface ValidationResult {
  rows: ValidatedRow[]
  summary: ValidationSummary
}

function issue(
  field: ImportFieldKey | 'row',
  severity: IssueSeverity,
  message: string,
  messageAr: string,
): RowIssue {
  return { field, severity, message, messageAr }
}

function compare(
  differences: FieldDifference[],
  field: string,
  existing: string | null | undefined,
  incoming: string | null | undefined,
) {
  const left = (existing ?? '').trim()
  const right = (incoming ?? '').trim()
  if (!right) return
  if (left.toLowerCase() === right.toLowerCase()) return
  differences.push({ field, existing: left || '—', incoming: right })
}

/** Human-meaningful differences only; ids and timestamps are ignored. */
export function diffCandidateData(
  existing: ImportedCandidateData,
  incoming: ImportedCandidateData,
): FieldDifference[] {
  const differences: FieldDifference[] = []
  compare(differences, 'Full name', existing.fullName, incoming.fullName)
  compare(differences, 'Phone', existing.phone, incoming.phone)
  compare(differences, 'Location', existing.location, incoming.location)
  compare(differences, 'Headline', existing.headline, incoming.headline)
  compare(differences, 'Summary', existing.bio, incoming.bio)
  compare(differences, 'LinkedIn', existing.linkedinUrl, incoming.linkedinUrl)
  compare(differences, 'Skills', existing.skills.join(', '), incoming.skills.join(', '))
  compare(
    differences,
    'Languages',
    existing.languages.map((item) => `${item.name}:${item.level}`).join(', '),
    incoming.languages.map((item) => `${item.name}:${item.level}`).join(', '),
  )
  compare(
    differences,
    'Education',
    existing.education.map((item) => `${item.institution}|${item.program}`).join(', '),
    incoming.education.map((item) => `${item.institution}|${item.program}`).join(', '),
  )
  compare(
    differences,
    'Experience',
    existing.experience.map((item) => `${item.company}|${item.title}`).join(', '),
    incoming.experience.map((item) => `${item.company}|${item.title}`).join(', '),
  )
  compare(
    differences,
    'SEH training',
    existing.sehTraining.map((item) => item.program).join(', '),
    incoming.sehTraining.map((item) => item.program).join(', '),
  )
  return differences
}

export interface ValidateOptions {
  sheet: ParsedSheet
  mapping: ColumnMapping
  directory: CandidateDirectoryEntry[]
  newId?: IdFactory
}

export function validateImportRows({
  sheet,
  mapping,
  directory,
  newId,
}: ValidateOptions): ValidationResult {
  const directoryByEmail = new Map(
    directory.map((entry) => [entry.normalizedEmail, entry] as const),
  )
  const seenInFile = new Map<string, number>()
  const rows: ValidatedRow[] = []

  sheet.rows.forEach((cells, index) => {
    const rowNumber = index + 2
    const values: Record<string, string> = {}
    mapping.forEach((key, columnIndex) => {
      if (!key) return
      values[key] = cells[columnIndex] ?? ''
    })

    const issues: RowIssue[] = []

    const fullName = normalizeName(values.fullName)
    if (!fullName) {
      issues.push(
        issue('fullName', 'error', 'Full name is required.', 'الاسم الكامل مطلوب.'),
      )
    }

    const rawEmail = values.email ?? ''
    const normalizedEmail = normalizeEmail(rawEmail)
    if (!normalizedEmail) {
      issues.push(issue('email', 'error', 'Email is required.', 'البريد الإلكتروني مطلوب.'))
    } else if (!isValidEmail(normalizedEmail)) {
      issues.push(
        issue(
          'email',
          'error',
          `"${cleanText(rawEmail)}" is not a valid email address.`,
          `"${cleanText(rawEmail)}" ليس بريدًا إلكترونيًا صالحًا.`,
        ),
      )
    }

    const phone = normalizePhone(values.phone)
    if (!phone.recognized) {
      issues.push(
        issue(
          'phone',
          'warning',
          'Phone number kept as provided - it does not match a known format.',
          'تم الاحتفاظ برقم الهاتف كما هو لأنه لا يطابق صيغة معروفة.',
        ),
      )
    }

    const remoteRaw = cleanText(values.remotePreference)
    const remotePreference = remoteRaw ? parseRemotePreference(remoteRaw) : null
    if (remoteRaw && !remotePreference) {
      issues.push(
        issue(
          'remotePreference',
          'warning',
          `Unknown work mode "${remoteRaw}" - defaulted to flexible.`,
          `نمط عمل غير معروف "${remoteRaw}" - تم اعتماد "مرن".`,
        ),
      )
    }

    const availabilityRaw = cleanText(values.availabilityTiming)
    const availabilityTiming = availabilityRaw
      ? parseAvailabilityTiming(availabilityRaw)
      : null
    if (availabilityRaw && !availabilityTiming) {
      issues.push(
        issue(
          'availabilityTiming',
          'warning',
          `Unknown availability "${availabilityRaw}" - defaulted to immediate.`,
          `جاهزية غير معروفة "${availabilityRaw}" - تم اعتماد "فوراً".`,
        ),
      )
    }

    const openToWorkRaw = cleanText(values.openToWork)
    const openToWork = openToWorkRaw ? parseBoolean(openToWorkRaw) : null
    if (openToWorkRaw && openToWork === null) {
      issues.push(
        issue(
          'openToWork',
          'warning',
          `Unknown value "${openToWorkRaw}" for open to work - defaulted to yes.`,
          `قيمة غير معروفة "${openToWorkRaw}" لحقل متاح للعمل - تم اعتماد "نعم".`,
        ),
      )
    }

    const linkedinRaw = textOrNull(values.linkedinUrl)
    let linkedinUrl = linkedinRaw
    if (linkedinRaw && !/^https?:\/\//i.test(linkedinRaw)) {
      if (/^([\w-]+\.)*linkedin\.com\//i.test(linkedinRaw)) {
        linkedinUrl = `https://${linkedinRaw}`
      } else {
        issues.push(
          issue(
            'linkedinUrl',
            'warning',
            'LinkedIn value does not look like a URL.',
            'قيمة لينكدإن لا تبدو كرابط صالح.',
          ),
        )
      }
    }

    const structuredSkills = parseStructuredSkills(values.skills, newId)
    const provider = textOrNull(values.sehProvider)
    const completionDate = normalizeDate(values.sehCompletionDate)

    const data: ImportedCandidateData = {
      fullName,
      email: cleanText(rawEmail),
      normalizedEmail,
      phone: phone.value,
      location: textOrNull(values.location),
      headline: textOrNull(values.headline),
      bio: textOrNull(values.bio),
      skills: structuredSkills.map((skill) => skill.name),
      structuredSkills,
      languages: parseLanguages(values.languages, newId),
      education: parseEducation(values.education, newId),
      experience: parseExperience(values.experience, newId),
      sehTraining: parseTraining(values.sehTraining, provider, completionDate, newId),
      careerPreferences: {
        openToWork: openToWork ?? true,
        employmentTypes: splitList(values.employmentTypes),
        preferredFields: splitList(values.preferredFields),
        preferredLocations: splitList(values.preferredLocations),
        remotePreference: remotePreference ?? 'flexible',
        availabilityTiming: availabilityTiming ?? 'immediate',
      },
      linkedinUrl,
      notes: textOrNull(values.notes),
    }

    const hasError = issues.some((item) => item.severity === 'error')
    let status: ImportRowStatus = hasError ? 'error' : 'valid'
    let match: RowMatch | null = null

    if (!hasError) {
      const firstSeenRow = seenInFile.get(normalizedEmail)
      if (firstSeenRow) {
        status = 'duplicate_in_file'
        issues.push(
          issue(
            'email',
            'error',
            `Duplicate of row ${firstSeenRow} in this file.`,
            `مكرر مع الصف ${firstSeenRow} في نفس الملف.`,
          ),
        )
      } else {
        seenInFile.set(normalizedEmail, rowNumber)
        const existing = directoryByEmail.get(normalizedEmail)
        if (existing) {
          if (existing.source === 'registered') {
            status = 'existing_candidate'
            match = {
              source: 'registered',
              id: existing.id,
              fullName: existing.fullName,
              differences: existing.data ? diffCandidateData(existing.data, data) : [],
            }
            issues.push(
              issue(
                'email',
                'error',
                existing.role === 'candidate'
                  ? 'A candidate account already exists for this email - the existing record was left untouched.'
                  : `This email already belongs to a ${existing.role} account - it was skipped.`,
                existing.role === 'candidate'
                  ? 'يوجد حساب مرشح بهذا البريد - تم ترك السجل الحالي دون تغيير.'
                  : 'هذا البريد مرتبط بحساب آخر على المنصة - تم تخطي الصف.',
              ),
            )
          } else {
            const differences = existing.data ? diffCandidateData(existing.data, data) : []
            if (differences.length > 0) {
              status = 'conflict'
              issues.push(
                issue(
                  'row',
                  'error',
                  'Already imported with different data - review before deciding.',
                  'تم استيراده سابقًا ببيانات مختلفة - يرجى المراجعة قبل اتخاذ القرار.',
                ),
              )
            } else {
              status = 'existing_candidate'
              issues.push(
                issue(
                  'email',
                  'error',
                  'Already imported previously - skipped.',
                  'تم استيراده سابقًا - تم تخطي الصف.',
                ),
              )
            }
            match = {
              source: 'imported',
              id: existing.id,
              fullName: existing.fullName,
              differences,
            }
          }
        }
      }
    }

    rows.push({ rowNumber, values, data: status === 'error' ? null : data, status, issues, match })
  })

  return { rows, summary: summarize(rows) }
}

export function summarize(rows: ValidatedRow[]): ValidationSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === 'valid').length,
    errors: rows.filter((row) => row.status === 'error').length,
    duplicatesInFile: rows.filter((row) => row.status === 'duplicate_in_file').length,
    existingCandidates: rows.filter((row) => row.status === 'existing_candidate').length,
    conflicts: rows.filter((row) => row.status === 'conflict').length,
    warnings: rows.filter((row) =>
      row.issues.some((item) => item.severity === 'warning'),
    ).length,
  }
}

/** Rows that will actually be written when the admin confirms the import. */
export function importableRows(rows: ValidatedRow[]): ValidatedRow[] {
  return rows.filter((row) => row.status === 'valid' && row.data !== null)
}

/** Rows that could not be imported, for the error-report download. */
export function rejectedRows(rows: ValidatedRow[]): ValidatedRow[] {
  return rows.filter((row) => row.status !== 'valid')
}

export function rowIssueText(row: ValidatedRow, language: 'en' | 'ar' = 'en'): string {
  return row.issues
    .map((item) => {
      const label =
        item.field === 'row'
          ? ''
          : `${IMPORT_FIELD_BY_KEY.get(item.field)?.[language === 'ar' ? 'labelAr' : 'label'] ?? item.field}: `
      return `${label}${language === 'ar' ? item.messageAr : item.message}`
    })
    .join(' | ')
}
