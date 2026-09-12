/**
 * Career Services workflow rules.
 *
 * Pure functions and the single source of truth for which status transitions
 * are legal. Both backends and both UIs go through here, so no screen can
 * offer a transition the domain does not allow.
 */
import type {
  CareerService,
  CareerServiceInputField,
  CareerServicePaymentStatus,
  CareerServiceRequest,
  CareerServiceRequestStatus,
  CareerServiceResult,
  CandidateProfile,
  TalentDocument,
} from '@/types/domain'

export const CAREER_REQUEST_STATUSES: CareerServiceRequestStatus[] = [
  'requested',
  'payment_pending',
  'ready',
  'assigned',
  'in_progress',
  'waiting_candidate',
  'scheduled',
  'completed',
  'cancelled',
]

const TRANSITIONS: Record<CareerServiceRequestStatus, CareerServiceRequestStatus[]> = {
  requested: ['payment_pending', 'ready', 'cancelled'],
  payment_pending: ['ready', 'cancelled'],
  ready: ['assigned', 'in_progress', 'scheduled', 'cancelled'],
  assigned: ['in_progress', 'scheduled', 'waiting_candidate', 'cancelled'],
  in_progress: ['waiting_candidate', 'scheduled', 'completed', 'cancelled'],
  waiting_candidate: ['in_progress', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function canTransition(
  from: CareerServiceRequestStatus,
  to: CareerServiceRequestStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowedTransitions(
  from: CareerServiceRequestStatus,
): CareerServiceRequestStatus[] {
  return [...TRANSITIONS[from]]
}

export function assertTransition(
  from: CareerServiceRequestStatus,
  to: CareerServiceRequestStatus,
): void {
  if (from === to) {
    throw new Error(`This request is already ${STATUS_LABELS[to].toLowerCase()}.`)
  }
  if (!canTransition(from, to)) {
    throw new Error(
      `Cannot move a request from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[to]}".`,
    )
  }
}

export const STATUS_LABELS: Record<CareerServiceRequestStatus, string> = {
  requested: 'Requested',
  payment_pending: 'Payment pending',
  ready: 'Ready to start',
  assigned: 'Assigned',
  in_progress: 'In progress',
  waiting_candidate: 'Waiting for you',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_LABELS_AR: Record<CareerServiceRequestStatus, string> = {
  requested: 'تم الطلب',
  payment_pending: 'بانتظار الدفع',
  ready: 'جاهز للبدء',
  assigned: 'تم الإسناد',
  in_progress: 'قيد التنفيذ',
  waiting_candidate: 'بانتظار ردك',
  scheduled: 'تم تحديد موعد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const TERMINAL: CareerServiceRequestStatus[] = ['completed', 'cancelled']

export function isActiveRequest(request: CareerServiceRequest): boolean {
  return !TERMINAL.includes(request.status)
}

/** Free services skip straight to work; paid ones wait on manual payment. */
export function initialStatusFor(service: CareerService): CareerServiceRequestStatus {
  return service.pricingType === 'free' ? 'ready' : 'payment_pending'
}

export function initialPaymentStatusFor(
  service: CareerService,
): CareerServicePaymentStatus {
  return service.pricingType === 'free' ? 'not_required' : 'pending'
}

/** A requester may withdraw only before staff work has started. */
export function candidateCanCancel(
  request: Pick<CareerServiceRequest, 'status'>,
): boolean {
  return (
    ['requested', 'payment_pending', 'ready', 'waiting_candidate', 'scheduled'].includes(
      request.status,
    )
  )
}

export function candidateMustRespond(request: CareerServiceRequest): boolean {
  return request.status === 'waiting_candidate'
}

/**
 * Blocks a second live request for the same service unless the service is
 * explicitly repeatable (assessments and sessions).
 */
export function findBlockingRequest(
  service: CareerService,
  existing: CareerServiceRequest[],
): CareerServiceRequest | null {
  if (service.allowsRepeatRequests) {
    // Even repeatable services allow only one request in flight at a time.
    return existing.find((request) => isActiveRequest(request)) ?? null
  }
  return (
    existing.find(
      (request) => isActiveRequest(request) || request.status === 'completed',
    ) ?? null
  )
}

export interface StaffAction {
  status: CareerServiceRequestStatus
  label: string
  labelAr: string
  /** Needs a scheduled date before it can be applied. */
  requiresSchedule?: boolean
  /** Needs a result before it can be applied. */
  requiresResult?: boolean
  /** Needs a message explaining what is required from the candidate. */
  requiresMessage?: boolean
  variant: 'primary' | 'secondary' | 'danger'
}

/**
 * The contextual actions staff may take right now. Derived from the transition
 * table, so the UI can never present an illegal move.
 *
 * Takes only the fields it needs, so employer service requests (35, 36) reuse
 * exactly the same action derivation as candidate requests.
 */
export function staffActionsFor(
  request: Pick<CareerServiceRequest, 'status' | 'paymentStatus'>,
  service: Pick<CareerService, 'requiresScheduling'>,
): StaffAction[] {
  const catalogue: Record<string, StaffAction> = {
    ready: {
      status: 'ready',
      label: 'Mark payment received',
      labelAr: 'تأكيد استلام الدفعة',
      variant: 'primary',
    },
    assigned: {
      status: 'assigned',
      label: 'Assign to me',
      labelAr: 'إسناد لي',
      variant: 'secondary',
    },
    in_progress: {
      status: 'in_progress',
      label: 'Start work',
      labelAr: 'بدء العمل',
      variant: 'primary',
    },
    waiting_candidate: {
      status: 'waiting_candidate',
      label: 'Request information',
      labelAr: 'طلب معلومات',
      variant: 'secondary',
      requiresMessage: true,
    },
    scheduled: {
      status: 'scheduled',
      label: 'Schedule session',
      labelAr: 'تحديد موعد',
      variant: 'primary',
      requiresSchedule: true,
    },
    completed: {
      status: 'completed',
      label: 'Complete request',
      labelAr: 'إنهاء الطلب',
      variant: 'primary',
      requiresResult: true,
    },
    cancelled: {
      status: 'cancelled',
      label: 'Cancel request',
      labelAr: 'إلغاء الطلب',
      variant: 'danger',
    },
  }

  return allowedTransitions(request.status)
    .filter((status) => {
      // Scheduling is only meaningful for services that are actually scheduled.
      if (status === 'scheduled' && !service.requiresScheduling) return false
      // "Mark payment received" only makes sense while payment is outstanding.
      if (status === 'ready' && request.paymentStatus !== 'pending') return false
      return true
    })
    .map((status) => catalogue[status])
    .filter((action): action is StaffAction => Boolean(action))
}

/* --------------------------- CV Readiness Check --------------------------- */

const READINESS_WEIGHTS = {
  cvUploaded: 25,
  headline: 10,
  summary: 10,
  skills: 10,
  background: 10,
  cvTailored: 10,
  achievementsQuantified: 10,
  contactDetailsCurrent: 8,
  onePageFormat: 7,
} as const

function isYes(value: string | undefined): boolean {
  return value === 'true' || value === 'yes'
}

/**
 * Deterministic readiness scoring - no AI. Combines stored Talent Passport
 * state with the short checklist the candidate answers.
 */
export function computeCvReadiness(
  profile: CandidateProfile | null | undefined,
  documents: TalentDocument[],
  answers: Record<string, string>,
): CareerServiceResult {
  const hasCv = documents.some((document) => document.type === 'cv')
  const skillCount = profile?.structuredSkills.length || profile?.skills.length || 0
  const hasBackground = Boolean(profile?.education.length || profile?.experience.length)

  const checks: { key: keyof typeof READINESS_WEIGHTS; passed: boolean; gap: string }[] = [
    { key: 'cvUploaded', passed: hasCv, gap: 'Upload your CV so it can be reviewed and shared.' },
    {
      key: 'headline',
      passed: Boolean(profile?.headline),
      gap: 'Add a professional headline to your Talent Passport.',
    },
    {
      key: 'summary',
      passed: Boolean(profile?.bio),
      gap: 'Write a short professional summary describing what you do.',
    },
    {
      key: 'skills',
      passed: skillCount >= 3,
      gap: 'List at least three skills with a category and level.',
    },
    {
      key: 'background',
      passed: hasBackground,
      gap: 'Add your education or professional experience.',
    },
    {
      key: 'cvTailored',
      passed: isYes(answers.cvTailored),
      gap: 'Tailor your CV to each role instead of sending one generic version.',
    },
    {
      key: 'achievementsQuantified',
      passed: isYes(answers.achievementsQuantified),
      gap: 'Describe achievements with numbers, for example "reduced reporting time by 30%".',
    },
    {
      key: 'contactDetailsCurrent',
      passed: isYes(answers.contactDetailsCurrent),
      gap: 'Update the phone number and email on your CV.',
    },
    {
      key: 'onePageFormat',
      passed: isYes(answers.onePageFormat),
      gap: 'Reformat your CV into a clean, consistent 1-2 page layout.',
    },
  ]

  const score = checks.reduce(
    (total, check) => (check.passed ? total + READINESS_WEIGHTS[check.key] : total),
    0,
  )
  const improvementAreas = checks.filter((check) => !check.passed).map((check) => check.gap)

  const scoreLabel =
    score >= 85
      ? 'Ready to apply'
      : score >= 60
        ? 'Nearly ready'
        : score >= 35
          ? 'Needs work'
          : 'Not ready yet'

  const recommendations =
    improvementAreas.length === 0
      ? ['Your CV and Talent Passport are complete. Keep them updated as you gain experience.']
      : improvementAreas.slice(0, 3)

  const targetRole = answers.targetRole?.trim()

  return {
    summary: targetRole
      ? `Readiness for "${targetRole}": ${scoreLabel} (${score}/100).`
      : `CV readiness: ${scoreLabel} (${score}/100).`,
    score,
    scoreLabel,
    improvementAreas,
    recommendations,
    deliverableUrl: null,
    deliverableName: null,
  }
}

/* ------------------------- Job application readiness ---------------------- */

/**
 * Deterministic, transparent scoring - no AI, no professional judgement is
 * implied. Combines stored Talent Passport state with a short checklist.
 */
export function computeApplicationReadiness(
  profile: CandidateProfile | null | undefined,
  documents: TalentDocument[],
  answers: Record<string, string>,
): CareerServiceResult {
  const hasCv = documents.some((document) => document.type === 'cv')
  const skillCount = profile?.structuredSkills.length || profile?.skills.length || 0
  const hasBackground = Boolean(profile?.education.length || profile?.experience.length)
  const targetRole = answers.targetRole?.trim()

  const checks: { weight: number; passed: boolean; gap: string; strength: string }[] = [
    {
      weight: 20,
      passed: hasCv,
      gap: 'Upload your CV before applying.',
      strength: 'Your CV is on file.',
    },
    {
      weight: 15,
      passed: Boolean(targetRole),
      gap: 'Decide on the specific role you are applying for.',
      strength: 'You have a specific target role.',
    },
    {
      weight: 10,
      passed: Boolean(profile?.headline && profile.bio),
      gap: 'Complete your headline and professional summary.',
      strength: 'Your professional profile is written.',
    },
    {
      weight: 10,
      passed: skillCount >= 3,
      gap: 'List at least three skills on your Talent Passport.',
      strength: 'Your skills are listed.',
    },
    {
      weight: 10,
      passed: hasBackground,
      gap: 'Add your education or professional experience.',
      strength: 'Your background is recorded.',
    },
    {
      weight: 15,
      passed: isYes(answers.cvTailoredForTarget),
      gap: 'Tailor your CV to this specific role before sending it.',
      strength: 'Your CV is tailored to this role.',
    },
    {
      weight: 10,
      passed: isYes(answers.coverLetterReady),
      gap: 'Prepare a cover letter for this application.',
      strength: 'Your cover letter is ready.',
    },
    {
      weight: 5,
      passed: isYes(answers.referencesReady),
      gap: 'Confirm your references are ready to be contacted.',
      strength: 'Your references are ready.',
    },
    {
      weight: 5,
      passed: isYes(answers.deadlinesTracked),
      gap: 'Note the application deadline so you do not miss it.',
      strength: 'You are tracking the deadline.',
    },
  ]

  return buildChecklistResult(
    checks,
    targetRole
      ? `Application readiness for "${targetRole}"`
      : 'Job application readiness',
  )
}

/* ---------------------------- Interview readiness ------------------------- */

/** Five equally weighted preparation checks the candidate answers themselves. */
export function computeInterviewReadiness(
  _profile: CandidateProfile | null | undefined,
  _documents: TalentDocument[],
  answers: Record<string, string>,
): CareerServiceResult {
  const targetRole = answers.targetRole?.trim()

  const checks = [
    {
      weight: 20,
      passed: isYes(answers.introductionPrepared),
      gap: 'Prepare and rehearse a two-minute professional introduction.',
      strength: 'You can introduce yourself clearly.',
    },
    {
      weight: 20,
      passed: isYes(answers.experienceExamplesPrepared),
      gap: 'Prepare concrete examples from your experience for common questions.',
      strength: 'You have experience examples ready.',
    },
    {
      weight: 20,
      passed: isYes(answers.achievementExamplesPrepared),
      gap: 'Prepare specific achievement examples, ideally with numbers.',
      strength: 'You have achievement examples ready.',
    },
    {
      weight: 20,
      passed: isYes(answers.employerResearchDone),
      gap: 'Research the employer: their work, their sector and recent news.',
      strength: 'You have researched the employer.',
    },
    {
      weight: 20,
      passed: isYes(answers.questionsPrepared),
      gap: 'Prepare two or three questions to ask the interviewer.',
      strength: 'You have questions prepared for them.',
    },
  ]

  return buildChecklistResult(
    checks,
    targetRole ? `Interview readiness for "${targetRole}"` : 'Interview readiness',
  )
}

interface ChecklistCheck {
  weight: number
  passed: boolean
  gap: string
  strength: string
}

function buildChecklistResult(
  checks: ChecklistCheck[],
  headline: string,
): CareerServiceResult {
  const score = checks.reduce(
    (total, check) => (check.passed ? total + check.weight : total),
    0,
  )
  const improvementAreas = checks.filter((check) => !check.passed).map((check) => check.gap)
  const strengths = checks.filter((check) => check.passed).map((check) => check.strength)
  const scoreLabel = readinessLabel(score)

  return {
    summary: `${headline}: ${scoreLabel} (${score}/100).`,
    score,
    scoreLabel,
    strengths,
    gaps: improvementAreas,
    improvementAreas,
    recommendations:
      improvementAreas.length === 0
        ? ['You are ready. Keep your Talent Passport up to date as things change.']
        : improvementAreas.slice(0, 3),
    deliverableUrl: null,
    deliverableName: null,
  }
}

function readinessLabel(score: number): string {
  if (score >= 85) return 'Ready to apply'
  if (score >= 60) return 'Nearly ready'
  if (score >= 35) return 'Needs work'
  return 'Not ready yet'
}

/**
 * Dispatches a free self-service assessment to its deterministic scorer.
 * Returns null for any service that is not a self-service assessment, so a
 * result can never be attached to a staff-delivered service.
 */
export function computeSelfServiceResult(
  service: CareerService,
  profile: CandidateProfile | null | undefined,
  documents: TalentDocument[],
  answers: Record<string, string>,
): CareerServiceResult | null {
  if (!service.selfService) return null
  switch (service.code) {
    case '07':
      return computeCvReadiness(profile, documents, answers)
    case '13':
      return computeApplicationReadiness(profile, documents, answers)
    case '19':
      return computeInterviewReadiness(profile, documents, answers)
    default:
      return null
  }
}

/* ------------------------------ Prerequisites ----------------------------- */

export interface PrerequisiteState {
  required: boolean
  met: boolean
  /** The service that must be completed first. */
  serviceCode: string | null
}

/**
 * A service may require a completed request of another service - service 26
 * (Interview Performance Report) needs a completed mock interview. Without one
 * the UI must route the candidate to the prerequisite rather than offer a
 * request it would reject.
 */
export function prerequisiteState(
  service: CareerService,
  requests: CareerServiceRequest[],
): PrerequisiteState {
  if (!service.prerequisiteServiceCode) {
    return { required: false, met: true, serviceCode: null }
  }
  const met = requests.some(
    (request) =>
      request.serviceCode === service.prerequisiteServiceCode &&
      request.status === 'completed',
  )
  return { required: true, met, serviceCode: service.prerequisiteServiceCode }
}

/** Completed requests a `reference` input field may point at. */
export function referenceOptions(
  field: CareerServiceInputField,
  requests: CareerServiceRequest[],
): CareerServiceRequest[] {
  if (!field.referenceServiceCode) return []
  return requests
    .filter(
      (request) =>
        request.serviceCode === field.referenceServiceCode &&
        request.status === 'completed',
    )
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
}

/* ---------------------------- recommendations ----------------------------- */

/**
 * Deterministic "recommended for you" list - profile and request state only,
 * no scoring model. Recommendations are for discovery, so anything already
 * requested is skipped: it lives in its category with its own state.
 */
export function recommendedServices(input: {
  services: CareerService[]
  profile: CandidateProfile | null | undefined
  documents: TalentDocument[]
  requests: CareerServiceRequest[]
  limit?: number
}): CareerService[] {
  const { services, profile, documents, requests, limit = 3 } = input
  const byCode = new Map(services.map((service) => [service.code, service]))
  const requested = new Set(requests.map((request) => request.serviceCode))

  const hasCv = documents.some((document) => document.type === 'cv')
  const targetsNgo = /ngo|ingo|humanitarian|development|non-profit|nonprofit/.test(
    [...(profile?.careerPreferences.preferredFields ?? []), profile?.headline ?? '']
      .join(' ')
      .toLowerCase(),
  )
  const completedMockInterview = requests.some(
    (request) => request.serviceCode === '21' && request.status === 'completed',
  )
  const hasInterviewActivity = requests.some((request) =>
    ['20', '21', '23', '24', '25'].includes(request.serviceCode),
  )
  const hasTargetedJob = requests.some((request) =>
    Boolean(request.candidateInput.jobDescription),
  )

  // Ordered by how useful the step is right now.
  const codes: string[] = []
  if (completedMockInterview) codes.push('26')
  if (!hasCv) codes.push('07', '08')
  else codes.push('09')
  if (hasTargetedJob) codes.push('10', '13')
  if (hasInterviewActivity) codes.push('19')
  if (targetsNgo) codes.push('11', '18', '25')
  codes.push('13', '19', '14')

  const suggestions: CareerService[] = []
  for (const code of codes) {
    if (suggestions.length >= limit) break
    const service = byCode.get(code)
    if (!service?.active) continue
    if (suggestions.some((item) => item.code === code)) continue
    if (requested.has(code)) continue
    if (!prerequisiteState(service, requests).met) continue
    suggestions.push(service)
  }
  return suggestions
}

/* ------------------------------ presentation ------------------------------ */

/**
 * What the candidate receives, derived from the result type so every service
 * answers "what will SEH give me?" without per-service copy.
 */
export function deliverableKeyFor(service: CareerService): string {
  switch (service.resultType) {
    case 'document':
      return 'careerServices.youReceive.document'
    case 'recommendations':
      return 'careerServices.youReceive.recommendations'
    case 'session':
      return 'careerServices.youReceive.session'
    case 'assessment':
    default:
      return service.selfService
        ? 'careerServices.youReceive.selfAssessment'
        : 'careerServices.youReceive.report'
  }
}

/* ------------------------------- validation ------------------------------- */

export interface InputValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateServiceInput(
  service: CareerService,
  input: Record<string, string>,
): InputValidationResult {
  const errors: Record<string, string> = {}

  for (const field of service.inputFields) {
    const value = (input[field.key] ?? '').trim()
    if (field.required && !value) {
      errors[field.key] = `${field.label} is required.`
      continue
    }
    if (!value) continue
    if (field.type === 'url' && !/^https?:\/\/.+\..+/i.test(value)) {
      errors[field.key] = `${field.label} must be a valid URL.`
    }
    if (field.type === 'select' && field.options) {
      if (!field.options.some((option) => option.value === value)) {
        errors[field.key] = `Choose a valid option for ${field.label}.`
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/** Talent Passport values used to prefill a service form. */
export function prefillFromPassport(
  service: CareerService,
  profile: CandidateProfile | null | undefined,
): Record<string, string> {
  const input: Record<string, string> = {}
  for (const field of service.inputFields) {
    if (!field.prefillFrom || !profile) continue
    const value = profile[field.prefillFrom]
    if (typeof value === 'string' && value.trim()) input[field.key] = value
  }
  return input
}
