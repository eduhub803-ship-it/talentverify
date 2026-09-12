/**
 * Value normalization for the bulk candidate import.
 * Pure functions only - shared by the mock and Supabase import paths so both
 * persist byte-identical candidate data.
 */
import type {
  AvailabilityTiming,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateSkill,
  CandidateTrainingRecord,
  RemotePreference,
  SkillCategory,
  SkillLevel,
} from '@/types/domain'

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g

/** Converts Arabic-Indic digits to ASCII and collapses invisible characters. */
export function normalizeDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) => {
      const code = digit.charCodeAt(0)
      const base = code >= 0x06f0 ? 0x06f0 : 0x0660
      return String(code - base)
    })
    .replace(new RegExp('[\u200e\u200f\u202a-\u202e\u00a0]', 'g'), ' ')
}

export function cleanText(value: string | undefined | null): string {
  if (!value) return ''
  return normalizeDigits(String(value)).replace(/\s+/g, ' ').trim()
}

export function textOrNull(value: string | undefined | null): string | null {
  const cleaned = cleanText(value)
  return cleaned.length > 0 ? cleaned : null
}

/* ------------------------------- email -------------------------------- */

/**
 * Canonical duplicate key. Lower-cased and trimmed only - no provider specific
 * rewriting (dot stripping, plus-tags), which would merge distinct people.
 */
export function normalizeEmail(value: string | undefined | null): string {
  // Trimmed and lower-cased only: inner whitespace is left in place so that a
  // malformed address fails validation instead of being silently rewritten.
  return cleanText(value)
    .replace(/^[<(]|[>)]$/g, '')
    .toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\"]+@[^\s@.,;:<>()[\]\\"]+(\.[^\s@.,;:<>()[\]\\"]+)+$/

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value)
  if (!email || email.length > 254) return false
  if (email.includes('..')) return false
  const [local] = email.split('@')
  if (!local || local.length > 64) return false
  if (local.startsWith('.') || local.endsWith('.')) return false
  return EMAIL_PATTERN.test(email)
}

/* ------------------------------- phone -------------------------------- */

export interface PhoneResult {
  value: string | null
  recognized: boolean
}

/**
 * Jordan-first phone normalization.
 * Handles `07xxxxxxxx`, `7xxxxxxxx` (leading zero eaten by Excel), `00962...`
 * and `+962...`, and preserves other valid international numbers untouched.
 */
export function normalizePhone(input: string | undefined | null): PhoneResult {
  const raw = cleanText(input)
  if (!raw) return { value: null, recognized: true }

  const hadPlus = /^\s*\+/.test(raw)
  let digits = raw.replace(/[^\d]/g, '')
  if (!digits) return { value: raw, recognized: false }

  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith('962')) {
    const national = digits.slice(3).replace(/^0+/, '')
    if (national.length >= 8 && national.length <= 9) return { value: `+962${national}`, recognized: true }
    return { value: `+962${national}`, recognized: false }
  }

  // Local Jordanian formats: 07XXXXXXXX (mobile) / 06XXXXXXX (landline).
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return { value: `+962${digits.slice(1)}`, recognized: true }
  }

  // Excel dropped the leading zero: 7XXXXXXXX / 79XXXXXXX.
  if (!hadPlus && /^[789]\d{8}$/.test(digits)) {
    return { value: `+962${digits}`, recognized: true }
  }

  if (hadPlus && digits.length >= 8 && digits.length <= 15) {
    return { value: `+${digits}`, recognized: true }
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return { value: digits.length === 9 ? `+962${digits}` : `+${digits}`, recognized: digits.length === 9 }
  }

  return { value: raw, recognized: false }
}

/* -------------------------------- lists -------------------------------- */

/** Splits on `;`, `،`, `|`, newlines and `,` (when no stronger separator is present). */
export function splitList(value: string | undefined | null): string[] {
  const raw = normalizeDigits(String(value ?? ''))
  if (!raw.trim()) return []
  const strong = /[;|\n،]/.test(raw)
  const parts = strong ? raw.split(/[;|\n،]/) : raw.split(',')
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function splitEntry(entry: string): string[] {
  return entry.split(/[:>]/).map((part) => part.replace(/\s+/g, ' ').trim())
}

/* -------------------------------- enums -------------------------------- */

const SKILL_CATEGORIES: Record<string, SkillCategory> = {
  management: 'Management',
  إدارة: 'Management',
  digital: 'Digital',
  رقمي: 'Digital',
  ai: 'AI',
  'artificial intelligence': 'AI',
  'ذكاء اصطناعي': 'AI',
  communication: 'Communication',
  تواصل: 'Communication',
  technical: 'Technical',
  تقني: 'Technical',
  language: 'Language',
  لغة: 'Language',
  'sector specific': 'Sector Specific',
  sector: 'Sector Specific',
  'قطاع محدد': 'Sector Specific',
}

const SKILL_LEVELS: Record<string, SkillLevel> = {
  beginner: 'Beginner',
  basic: 'Beginner',
  مبتدئ: 'Beginner',
  intermediate: 'Intermediate',
  متوسط: 'Intermediate',
  advanced: 'Advanced',
  متقدم: 'Advanced',
  expert: 'Expert',
  fluent: 'Expert',
  native: 'Expert',
  خبير: 'Expert',
}

const REMOTE_PREFERENCES: Record<string, RemotePreference> = {
  onsite: 'onsite',
  'on-site': 'onsite',
  'on site': 'onsite',
  office: 'onsite',
  'من المكتب': 'onsite',
  hybrid: 'hybrid',
  هجين: 'hybrid',
  remote: 'remote',
  wfh: 'remote',
  'work from home': 'remote',
  'عن بعد': 'remote',
  flexible: 'flexible',
  any: 'flexible',
  مرن: 'flexible',
}

const AVAILABILITY_TIMINGS: Record<string, AvailabilityTiming> = {
  immediate: 'immediate',
  immediately: 'immediate',
  now: 'immediate',
  فورا: 'immediate',
  فوراً: 'immediate',
  two_weeks: 'two_weeks',
  '2 weeks': 'two_weeks',
  'two weeks': 'two_weeks',
  'أسبوعين': 'two_weeks',
  one_month: 'one_month',
  '1 month': 'one_month',
  'one month': 'one_month',
  'شهر': 'one_month',
  more_than_one_month: 'more_than_one_month',
  'more than one month': 'more_than_one_month',
  'أكثر من شهر': 'more_than_one_month',
}

const TRUE_VALUES = new Set([
  'true',
  'yes',
  'y',
  '1',
  'open',
  'نعم',
  'متاح',
])
const FALSE_VALUES = new Set(['false', 'no', 'n', '0', 'closed', 'لا', 'غير متاح'])

function lookup<T>(table: Record<string, T>, value: string): T | null {
  const key = cleanText(value).toLowerCase().replace(/[_-]+/g, ' ')
  return table[key] ?? table[key.replace(/ /g, '_')] ?? null
}

export function parseSkillCategory(value: string): SkillCategory | null {
  return lookup(SKILL_CATEGORIES, value)
}

export function parseSkillLevel(value: string): SkillLevel | null {
  return lookup(SKILL_LEVELS, value)
}

export function parseRemotePreference(value: string): RemotePreference | null {
  return lookup(REMOTE_PREFERENCES, value)
}

export function parseAvailabilityTiming(value: string): AvailabilityTiming | null {
  return lookup(AVAILABILITY_TIMINGS, value)
}

export function parseBoolean(value: string): boolean | null {
  const key = cleanText(value).toLowerCase()
  if (!key) return null
  if (TRUE_VALUES.has(key)) return true
  if (FALSE_VALUES.has(key)) return false
  return null
}

/* -------------------------------- dates -------------------------------- */

/** Accepts ISO, `dd/mm/yyyy`, `dd-mm-yyyy` and bare years. Returns the raw value when unknown. */
export function normalizeDate(value: string | undefined | null): string | null {
  const raw = cleanText(value)
  if (!raw) return null
  if (/^\d{4}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dmy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${month}-${day}`
  }
  const ymd = raw.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  }
  return raw
}

export function normalizeYear(value: string | undefined | null): string | null {
  const raw = cleanText(value)
  if (!raw) return null
  const year = raw.match(/(19|20)\d{2}/)
  return year ? year[0] : raw
}

/* --------------------------- structured fields -------------------------- */

export interface IdFactory {
  (): string
}

const fallbackId: IdFactory = () =>
  globalThis.crypto?.randomUUID?.() ??
  `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** `React:Technical:Expert; Excel:Digital; Teamwork` */
export function parseStructuredSkills(
  value: string | undefined | null,
  newId: IdFactory = fallbackId,
): CandidateSkill[] {
  return splitList(value).map((entry) => {
    const [name, category, level] = splitEntry(entry)
    return {
      id: newId(),
      name,
      category: (category && parseSkillCategory(category)) || 'Technical',
      level: level ? parseSkillLevel(level) : null,
    }
  })
}

/** `English:Expert; Arabic:Advanced` */
export function parseLanguages(
  value: string | undefined | null,
  newId: IdFactory = fallbackId,
): CandidateLanguage[] {
  return splitList(value).map((entry) => {
    const [name, level] = splitEntry(entry)
    return {
      id: newId(),
      name,
      level: (level && parseSkillLevel(level)) || 'Intermediate',
    }
  })
}

/** `University of Jordan|BSc Computer Science|2016|2020; ...` */
export function parseEducation(
  value: string | undefined | null,
  newId: IdFactory = fallbackId,
): CandidateEducation[] {
  const raw = normalizeDigits(String(value ?? ''))
  if (!raw.trim()) return []
  return raw
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|').map((part) => part.trim())
      return {
        id: newId(),
        institution: parts[0] ?? '',
        program: parts[1] ?? '',
        startYear: normalizeYear(parts[2]),
        endYear: normalizeYear(parts[3]),
      }
    })
}

/** `Zain|Data Analyst|2019|2022|Reporting and dashboards; ...` */
export function parseExperience(
  value: string | undefined | null,
  newId: IdFactory = fallbackId,
): CandidateExperience[] {
  const raw = normalizeDigits(String(value ?? ''))
  if (!raw.trim()) return []
  return raw
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|').map((part) => part.trim())
      return {
        id: newId(),
        company: parts[0] ?? '',
        title: parts[1] ?? '',
        startDate: normalizeDate(parts[2]),
        endDate: normalizeDate(parts[3]),
        description: textOrNull(parts[4]),
      }
    })
}

/**
 * SEH training rows land unverified: bulk import never asserts verification.
 * `SEH Digital Marketing|2026-04-01; ...`
 */
export function parseTraining(
  value: string | undefined | null,
  provider: string | null,
  completionDate: string | null,
  newId: IdFactory = fallbackId,
): CandidateTrainingRecord[] {
  const raw = normalizeDigits(String(value ?? ''))
  if (!raw.trim()) return []
  return raw
    .split(/[;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|').map((part) => part.trim())
      return {
        id: newId(),
        program: parts[0] ?? '',
        provider: textOrNull(parts[1]) ?? provider ?? 'SEH',
        completionDate: normalizeDate(parts[2]) ?? completionDate,
        verifiedBySeh: false,
      }
    })
}

/** Title-cases a full name while preserving non-Latin scripts as typed. */
export function normalizeName(value: string | undefined | null): string {
  const cleaned = cleanText(value).replace(/[,]+$/, '')
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((part) =>
      /^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join(' ')
}
