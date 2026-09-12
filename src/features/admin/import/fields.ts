/**
 * The column catalog for the bulk candidate import: which fields SEH staff can
 * supply, how their spreadsheet headers are auto-detected, and the downloadable
 * template that matches it.
 */

export type ImportFieldKey =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'location'
  | 'headline'
  | 'bio'
  | 'skills'
  | 'languages'
  | 'education'
  | 'experience'
  | 'sehTraining'
  | 'sehProvider'
  | 'sehCompletionDate'
  | 'linkedinUrl'
  | 'openToWork'
  | 'employmentTypes'
  | 'preferredFields'
  | 'preferredLocations'
  | 'remotePreference'
  | 'availabilityTiming'
  | 'notes'

export interface ImportFieldDefinition {
  key: ImportFieldKey
  label: string
  labelAr: string
  required: boolean
  /** Shown under the mapping dropdown so staff know the expected shape. */
  hint: string
  hintAr: string
  /** Lower-cased header aliases used for auto-detection. */
  aliases: string[]
  example: string
}

export const IMPORT_FIELDS: ImportFieldDefinition[] = [
  {
    key: 'fullName',
    label: 'Full name',
    labelAr: 'الاسم الكامل',
    required: true,
    hint: 'Candidate full name',
    hintAr: 'اسم المرشح الكامل',
    aliases: ['full name', 'name', 'candidate name', 'fullname', 'الاسم', 'الاسم الكامل', 'اسم المرشح'],
    example: 'Lina Haddad',
  },
  {
    key: 'email',
    label: 'Email',
    labelAr: 'البريد الإلكتروني',
    required: true,
    hint: 'Used as the unique candidate key',
    hintAr: 'يُستخدم كمعرّف فريد للمرشح',
    aliases: ['email', 'e-mail', 'email address', 'mail', 'البريد', 'البريد الالكتروني', 'البريد الإلكتروني'],
    example: 'lina.haddad@example.com',
  },
  {
    key: 'phone',
    label: 'Phone',
    labelAr: 'رقم الهاتف',
    required: false,
    hint: '07XXXXXXXX or +9627XXXXXXXX',
    hintAr: '07XXXXXXXX أو ‎+9627XXXXXXXX',
    aliases: ['phone', 'mobile', 'phone number', 'mobile number', 'tel', 'الهاتف', 'رقم الهاتف', 'الجوال'],
    example: '0791234567',
  },
  {
    key: 'location',
    label: 'Location',
    labelAr: 'الموقع',
    required: false,
    hint: 'City or governorate',
    hintAr: 'المدينة أو المحافظة',
    aliases: ['location', 'city', 'address', 'governorate', 'الموقع', 'المدينة', 'المحافظة'],
    example: 'Amman',
  },
  {
    key: 'headline',
    label: 'Headline',
    labelAr: 'العنوان المهني',
    required: false,
    hint: 'Professional headline',
    hintAr: 'العنوان المهني للمرشح',
    aliases: ['headline', 'title', 'job title', 'position', 'العنوان المهني', 'المسمى الوظيفي'],
    example: 'Junior Data Analyst',
  },
  {
    key: 'bio',
    label: 'Summary',
    labelAr: 'النبذة',
    required: false,
    hint: 'Short professional summary',
    hintAr: 'نبذة مهنية مختصرة',
    aliases: ['bio', 'summary', 'about', 'profile summary', 'النبذة', 'الملخص'],
    example: 'Graduate of the SEH data track.',
  },
  {
    key: 'skills',
    label: 'Skills',
    labelAr: 'المهارات',
    required: false,
    hint: 'Name:Category:Level separated by ";"',
    hintAr: 'المهارة:التصنيف:المستوى مفصولة بـ ";"',
    aliases: ['skills', 'skill', 'competencies', 'المهارات'],
    example: 'Excel:Digital:Advanced; SQL:Technical:Intermediate',
  },
  {
    key: 'languages',
    label: 'Languages',
    labelAr: 'اللغات',
    required: false,
    hint: 'Language:Level separated by ";"',
    hintAr: 'اللغة:المستوى مفصولة بـ ";"',
    aliases: ['languages', 'language', 'اللغات'],
    example: 'Arabic:Expert; English:Advanced',
  },
  {
    key: 'education',
    label: 'Education',
    labelAr: 'التعليم',
    required: false,
    hint: 'Institution|Program|StartYear|EndYear',
    hintAr: 'الجامعة|التخصص|سنة البداية|سنة التخرج',
    aliases: ['education', 'degree', 'university', 'التعليم', 'المؤهل العلمي'],
    example: 'University of Jordan|BSc Computer Science|2018|2022',
  },
  {
    key: 'experience',
    label: 'Experience',
    labelAr: 'الخبرة',
    required: false,
    hint: 'Company|Title|Start|End|Description',
    hintAr: 'الشركة|المسمى|البداية|النهاية|الوصف',
    aliases: ['experience', 'work experience', 'employment', 'الخبرة', 'الخبرات'],
    example: 'Zain|Data Analyst|2022|2024|Reporting',
  },
  {
    key: 'sehTraining',
    label: 'SEH training',
    labelAr: 'تدريب SEH',
    required: false,
    hint: 'Program|Provider|CompletionDate',
    hintAr: 'البرنامج|الجهة|تاريخ الإنجاز',
    aliases: ['seh training', 'training', 'program', 'course', 'التدريب', 'البرنامج التدريبي'],
    example: 'SEH Data Track|SEH|2026-05-15',
  },
  {
    key: 'sehProvider',
    label: 'Training provider',
    labelAr: 'جهة التدريب',
    required: false,
    hint: 'Default provider for the training column',
    hintAr: 'الجهة الافتراضية لعمود التدريب',
    aliases: ['provider', 'training provider', 'جهة التدريب'],
    example: 'SEH',
  },
  {
    key: 'sehCompletionDate',
    label: 'Training completion date',
    labelAr: 'تاريخ إنهاء التدريب',
    required: false,
    hint: 'YYYY-MM-DD or DD/MM/YYYY',
    hintAr: 'YYYY-MM-DD أو DD/MM/YYYY',
    aliases: [
      'completion date',
      'training completion date',
      'graduation date',
      'training date',
      'تاريخ الإنجاز',
      'تاريخ التخرج',
    ],
    example: '2026-05-15',
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    labelAr: 'لينكدإن',
    required: false,
    hint: 'Profile URL',
    hintAr: 'رابط الملف الشخصي',
    aliases: ['linkedin', 'linkedin url', 'linkedin profile', 'لينكدان', 'لينكدإن'],
    example: 'https://linkedin.com/in/lina-haddad',
  },
  {
    key: 'openToWork',
    label: 'Open to work',
    labelAr: 'متاح للعمل',
    required: false,
    hint: 'Yes / No',
    hintAr: 'نعم / لا',
    aliases: ['open to work', 'available', 'job seeking', 'متاح للعمل'],
    example: 'Yes',
  },
  {
    key: 'employmentTypes',
    label: 'Employment types',
    labelAr: 'أنواع التوظيف',
    required: false,
    hint: 'Full-time; Part-time',
    hintAr: 'دوام كامل؛ دوام جزئي',
    aliases: ['employment types', 'employment type', 'job type', 'نوع التوظيف', 'أنواع التوظيف'],
    example: 'Full-time; Internship',
  },
  {
    key: 'preferredFields',
    label: 'Preferred fields',
    labelAr: 'المجالات المفضلة',
    required: false,
    hint: 'Separated by ";"',
    hintAr: 'مفصولة بـ ";"',
    aliases: ['preferred fields', 'fields', 'industry', 'sector', 'المجالات المفضلة', 'القطاع'],
    example: 'Data; Marketing',
  },
  {
    key: 'preferredLocations',
    label: 'Preferred locations',
    labelAr: 'المواقع المفضلة',
    required: false,
    hint: 'Separated by ";"',
    hintAr: 'مفصولة بـ ";"',
    aliases: ['preferred locations', 'preferred location', 'المواقع المفضلة'],
    example: 'Amman; Remote',
  },
  {
    key: 'remotePreference',
    label: 'Work mode',
    labelAr: 'نمط العمل',
    required: false,
    hint: 'onsite / hybrid / remote / flexible',
    hintAr: 'من المكتب / هجين / عن بعد / مرن',
    aliases: ['remote preference', 'work mode', 'remote', 'نمط العمل'],
    example: 'hybrid',
  },
  {
    key: 'availabilityTiming',
    label: 'Availability',
    labelAr: 'الجاهزية',
    required: false,
    hint: 'immediate / two_weeks / one_month / more_than_one_month',
    hintAr: 'فوراً / أسبوعين / شهر / أكثر من شهر',
    aliases: ['availability', 'availability timing', 'notice period', 'الجاهزية', 'فترة الإشعار'],
    example: 'immediate',
  },
  {
    key: 'notes',
    label: 'Internal notes',
    labelAr: 'ملاحظات داخلية',
    required: false,
    hint: 'Visible to SEH staff only',
    hintAr: 'تظهر لفريق SEH فقط',
    aliases: ['notes', 'note', 'comments', 'remarks', 'ملاحظات'],
    example: 'Cohort 2026-A',
  },
]

export const REQUIRED_IMPORT_FIELDS = IMPORT_FIELDS.filter((field) => field.required).map(
  (field) => field.key,
)

export const IMPORT_FIELD_BY_KEY = new Map(IMPORT_FIELDS.map((field) => [field.key, field]))

/** `mapping[columnIndex] = field key`, or null when the column is ignored. */
export type ColumnMapping = (ImportFieldKey | null)[]

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_*]+/g, ' ')
    .replace(/[()[\]{}:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Best-effort header → field matching so staff usually never touch the mapping step. */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportFieldKey>()
  const mapping: ColumnMapping = headers.map(() => null)

  const assign = (index: number, key: ImportFieldKey) => {
    if (used.has(key) || mapping[index]) return
    mapping[index] = key
    used.add(key)
  }

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (!normalized) return
    const exact = IMPORT_FIELDS.find((field) =>
      field.aliases.some((alias) => normalizeHeader(alias) === normalized),
    )
    if (exact) assign(index, exact.key)
  })

  // Second pass: the longest matching alias wins, so "Training completion date"
  // resolves to the date field rather than to the shorter "training" alias.
  headers.forEach((header, index) => {
    if (mapping[index]) return
    const normalized = normalizeHeader(header)
    if (!normalized) return

    let best: { key: ImportFieldKey; length: number } | null = null
    for (const field of IMPORT_FIELDS) {
      for (const alias of field.aliases) {
        const candidate = normalizeHeader(alias)
        if (candidate.length <= 2) continue
        if (!normalized.includes(candidate) && !candidate.includes(normalized)) continue
        if (!best || candidate.length > best.length) {
          best = { key: field.key, length: candidate.length }
        }
      }
    }
    if (best) assign(index, best.key)
  })

  return mapping
}

export function missingRequiredFields(mapping: ColumnMapping): ImportFieldKey[] {
  return REQUIRED_IMPORT_FIELDS.filter((key) => !mapping.includes(key))
}

function csvCell(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** The downloadable starter file: headers plus one filled example row. */
export function buildImportTemplateCsv(): string {
  return toCsv([
    IMPORT_FIELDS.map((field) => field.label),
    IMPORT_FIELDS.map((field) => field.example),
  ])
}
