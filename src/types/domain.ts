export type UserRole = 'candidate' | 'hr' | 'admin' | 'super_admin'

export type VerificationStatus =
  | 'draft'
  | 'pending'
  | 'under_review'
  | 'verified'
  | 'rejected'

export type HrOrgStatus = 'pending' | 'approved' | 'rejected'

export type DocumentType = 'cv' | 'certificate' | 'experience'

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined'

export type UsageFeature = 'cv_evaluation'

export type JobStatus = 'draft' | 'open' | 'closed'

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

export type SkillCategory =
  | 'Management'
  | 'Digital'
  | 'AI'
  | 'Communication'
  | 'Technical'
  | 'Language'
  | 'Sector Specific'

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'

export type RemotePreference = 'onsite' | 'hybrid' | 'remote' | 'flexible'

export type AvailabilityTiming =
  | 'immediate'
  | 'two_weeks'
  | 'one_month'
  | 'more_than_one_month'

export interface CandidateSkill {
  id: string
  name: string
  category: SkillCategory
  level?: SkillLevel | null
}

export interface CandidateEducation {
  id: string
  institution: string
  program: string
  startYear?: string | null
  endYear?: string | null
}

export interface CandidateExperience {
  id: string
  company: string
  title: string
  startDate?: string | null
  endDate?: string | null
  description?: string | null
}

export interface CandidateLanguage {
  id: string
  name: string
  level: SkillLevel
}

export interface CandidateProject {
  id: string
  name: string
  description: string
  url?: string | null
}

export interface CandidateTrainingRecord {
  id: string
  program: string
  provider: string
  completionDate?: string | null
  verifiedBySeh: boolean
}

export interface CandidateCredential {
  id: string
  name: string
  issuer: string
  issueDate?: string | null
  documentId?: string | null
}

export interface CandidateCareerPreferences {
  openToWork: boolean
  employmentTypes: string[]
  preferredFields: string[]
  preferredLocations: string[]
  remotePreference: RemotePreference
  availabilityTiming: AvailabilityTiming
}

export type NotificationPriority = 'low' | 'normal' | 'high'

export interface AppNotification {
  id: string
  recipientUserId: string | null
  recipientRole: UserRole
  recipientOrganizationId?: string | null
  type: string
  title: string
  message: string
  entityType: string
  entityId: string
  isRead: boolean
  priority: NotificationPriority
  createdAt: string
}

/** HR-facing candidate directory (Supabase `candidates` table) */
export interface CandidateRecord {
  id: string
  sehTalentId?: string | null
  name: string
  email: string
  avatarUrl?: string | null
  cvUrl: string | null
  skills: string[]
  structuredSkills?: CandidateSkill[]
  experienceYears: number | null
  education: string | null
  aiSummary: string | null
  jobMatchScore: number | null
  location: string | null
  employerVisible?: boolean
  openToWork?: boolean
  employmentTypes?: string[]
  preferredFields?: string[]
  preferredLocations?: string[]
  remotePreference?: RemotePreference
  availabilityTiming?: AvailabilityTiming
}

export interface Profile {
  id: string
  role: UserRole
  email: string
  fullName: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface CandidateProfile {
  userId: string
  sehTalentId?: string | null
  headline: string | null
  location: string | null
  bio: string | null
  skills: string[]
  structuredSkills: CandidateSkill[]
  education: CandidateEducation[]
  experience: CandidateExperience[]
  languages: CandidateLanguage[]
  projects: CandidateProject[]
  sehTraining: CandidateTrainingRecord[]
  credentials: CandidateCredential[]
  careerPreferences: CandidateCareerPreferences
  linkedinUrl: string | null
  employerVisible: boolean
  verificationStatus: VerificationStatus
  verifiedAt: string | null
  rejectionReason: string | null
  updatedAt: string
  profile?: Pick<Profile, 'fullName' | 'email' | 'avatarUrl'>
}

/* --------------------- Employer & Recruitment Services --------------------- */

/**
 * Commercial tier held by an HR organization.
 * `partner` is Service 36 (SEH Corporate Talent Partnership) - an entitlement
 * layer, not a scheduled engagement.
 */
export type EmployerPlan = 'free' | 'pro' | 'partner'

export type PartnershipStatus = 'pending' | 'active' | 'inactive' | 'expired'

export interface EmployerPlanLimits {
  /** null means unlimited. */
  activeJobPosts: number | null
  searchResults: number | null
  shortlistSize: number | null
  matchedCandidates: number | null
}

/** Capabilities a plan unlocks. Never bypasses candidate privacy rules. */
export interface EmployerEntitlements {
  limits: EmployerPlanLimits
  talentRequests: boolean
  recruitmentAssessment: boolean
  advancedTalentSearch: boolean
  prioritySupport: boolean
  partnerBadge: boolean
}

/** Service 30: a candidate's saved search that raises notifications. */
export type JobAlertFrequency = 'immediate' | 'daily' | 'weekly'

export interface JobAlert {
  id: string
  candidateId: string
  name: string
  keywords: string[]
  location: string | null
  jobTypes: string[]
  tracks: OpportunityTrack[]
  exclusiveOnly: boolean
  frequency: JobAlertFrequency
  active: boolean
  createdAt: string
  updatedAt: string
  lastMatchedAt: string | null
  matchCount: number
}

/** Service 34: deterministic, explainable match between a job and a candidate. */
export interface CandidateJobMatch {
  candidateId: string
  candidateName: string
  headline: string | null
  location: string | null
  sehTalentId: string | null
  skills: string[]
  score: number
  matchedRequirements: string[]
  missingRequirements: string[]
  reasons: string[]
  shortlisted: boolean
}

/** Services 35 and 36: employer-purchased engagements. */
export interface EmployerService {
  id: string
  code: string
  name: string
  nameAr: string
  pricingType: CareerServicePricing
  description: string
  descriptionAr: string
  active: boolean
  requiresScheduling: boolean
  resultType: CareerServiceResultType
  allowsRepeatRequests: boolean
  inputFields: CareerServiceInputField[]
}

/**
 * Shares the canonical status, payment and result model with Career Services -
 * one workflow vocabulary across the whole product.
 */
/**
 * Service 34: one candidate put forward for a Talent Request. Links to the
 * candidate rather than copying them, and is invisible to the employer until
 * SEH submits the shortlist.
 */
export interface TalentRequestShortlistItem {
  id: string
  requestId: string
  candidateId: string
  /** Employer-visible note written by SEH. */
  employerNote: string | null
  rank: number
  addedAt: string
  addedBy: string
  /** Resolved for display; never stored twice. */
  candidateName?: string
  headline?: string | null
  location?: string | null
  sehTalentId?: string | null
  skills?: string[]
}

export interface EmployerServiceRequest {
  id: string
  organizationId: string
  requestedBy: string
  serviceCode: string
  status: CareerServiceRequestStatus
  paymentStatus: CareerServicePaymentStatus
  input: Record<string, string>
  notes: string | null
  adminMessage: string | null
  internalNotes: string | null
  assignedTo: string | null
  assignedToName?: string | null
  result: CareerServiceResult | null
  scheduledAt: string | null
  submittedAt: string
  completedAt: string | null
  updatedAt: string
  /** Service 34: set when SEH releases the shortlist to the employer. */
  shortlistSubmittedAt?: string | null
  organizationName?: string
  requestedByName?: string
}

/* ----------------------------- Career Services ---------------------------- */

export type CareerServiceCategory = 'cv_branding' | 'applications' | 'interview_prep'

export type CareerServicePricing = 'free' | 'paid' | 'premium'

export type CareerServiceResultType =
  | 'assessment'
  | 'document'
  | 'recommendations'
  | 'session'

/** One canonical status model shared by every career service. */
export type CareerServiceRequestStatus =
  | 'requested'
  | 'payment_pending'
  | 'ready'
  | 'assigned'
  | 'in_progress'
  | 'waiting_candidate'
  | 'scheduled'
  | 'completed'
  | 'cancelled'

/** Workflow metadata only - no payment processing exists yet. */
export type CareerServicePaymentStatus = 'not_required' | 'pending' | 'received'

export interface CareerServiceInputOption {
  value: string
  label: string
  labelAr: string
}

export interface CareerServiceInputField {
  key: string
  label: string
  labelAr: string
  type: 'text' | 'textarea' | 'url' | 'select' | 'boolean' | 'reference'
  required: boolean
  placeholder?: string
  options?: CareerServiceInputOption[]
  /** Prefilled from the Talent Passport so nothing is asked twice. */
  prefillFrom?: 'linkedinUrl' | 'headline' | 'location'
  /**
   * For `reference` fields: options are the candidate's own completed requests
   * of this service, letting one service point at the outcome of another.
   */
  referenceServiceCode?: string
  helpText?: string
  helpTextAr?: string
}

export interface CareerService {
  id: string
  /** Catalog number from the service list (07-26). */
  code: string
  name: string
  nameAr: string
  category: CareerServiceCategory
  pricingType: CareerServicePricing
  description: string
  descriptionAr: string
  active: boolean
  requiresJobDescription: boolean
  requiresCV: boolean
  requiresScheduling: boolean
  resultType: CareerServiceResultType
  /** Assessments may be repeated; document services may not while one is open. */
  allowsRepeatRequests: boolean
  /** Completed by the candidate without staff involvement. */
  selfService: boolean
  /** Must have a completed request of this service before requesting this one. */
  prerequisiteServiceCode?: string
  /** Suggested as the natural next step once this service completes. */
  followUpServiceCode?: string
  /** Secondary pricing note, e.g. a free tier with a paid in-depth version. */
  pricingNote?: string
  pricingNoteAr?: string
  inputFields: CareerServiceInputField[]
}

export interface CareerServiceResult {
  summary: string
  score?: number | null
  scoreLabel?: string | null
  /** What the candidate is already doing well. */
  strengths?: string[]
  /** Requirements or evidence the candidate is missing. */
  gaps?: string[]
  improvementAreas?: string[]
  recommendations?: string[]
  deliverableUrl?: string | null
  deliverableName?: string | null
}

export interface CareerServiceRequest {
  id: string
  candidateId: string
  serviceCode: string
  status: CareerServiceRequestStatus
  paymentStatus: CareerServicePaymentStatus
  candidateInput: Record<string, string>
  /** Written by the candidate. */
  candidateNotes: string | null
  /** Written by staff, shown to the candidate. */
  adminMessage: string | null
  /** Written by staff, never shown to the candidate. */
  internalNotes: string | null
  assignedTo: string | null
  assignedToName?: string | null
  result: CareerServiceResult | null
  scheduledAt: string | null
  submittedAt: string
  completedAt: string | null
  updatedAt: string
  candidateName?: string
  candidateEmail?: string
}

/** Bulk-imported candidate roster (Supabase `imported_candidates` table). */
export type ImportedCandidateStatus = 'imported' | 'claimed'

export interface ImportedCandidateData {
  fullName: string
  email: string
  normalizedEmail: string
  phone: string | null
  location: string | null
  headline: string | null
  bio: string | null
  skills: string[]
  structuredSkills: CandidateSkill[]
  languages: CandidateLanguage[]
  education: CandidateEducation[]
  experience: CandidateExperience[]
  sehTraining: CandidateTrainingRecord[]
  careerPreferences: CandidateCareerPreferences
  linkedinUrl: string | null
  notes: string | null
}

export interface ImportedCandidate extends ImportedCandidateData {
  id: string
  batchId: string
  status: ImportedCandidateStatus
  claimedUserId: string | null
  claimedAt: string | null
  sourceRowNumber: number
  createdAt: string
  updatedAt: string
}

export interface CandidateImportBatch {
  id: string
  fileName: string
  importedBy: string
  createdAt: string
  totalRows: number
  createdCount: number
  skippedDuplicateCount: number
  conflictCount: number
  errorCount: number
}

/** One row of the admin-side directory used to detect duplicates before importing. */
export interface CandidateDirectoryEntry {
  normalizedEmail: string
  source: 'registered' | 'imported'
  /** profiles.id for registered users, imported_candidates.id for roster rows */
  id: string
  fullName: string | null
  role: UserRole
  status: ImportedCandidateStatus | null
  data: ImportedCandidateData | null
}

export interface HrOrganization {
  id: string
  name: string
  website: string | null
  industry: string | null
  status: HrOrgStatus
  approvedAt: string | null
  createdAt: string
  /** Service 31: employer profile submitted for verification. */
  description?: string | null
  companySize?: string | null
  location?: string | null
  contactEmail?: string | null
  profileSubmittedAt?: string | null
  /** Services 32/33/36 commercial tier. */
  plan?: EmployerPlan
  /** Service 36 partnership state. Only meaningful when plan is `partner`. */
  partnershipStatus?: PartnershipStatus | null
  partnershipStartDate?: string | null
  partnershipEndDate?: string | null
  /** Written by SEH staff, never exposed to the employer. */
  partnershipNotes?: string | null
}

export interface HrMember {
  userId: string
  organizationId: string
  isOwner: boolean
  organization?: HrOrganization
}

export interface TalentDocument {
  id: string
  candidateId: string
  type: DocumentType
  fileName: string
  storagePath: string
  mimeType: string | null
  fileSize: number | null
  uploadedAt: string
  /** Resolved URL for preview/download (mock or signed URL) */
  publicUrl?: string | null
}

export interface ContactRequest {
  id: string
  hrUserId: string
  candidateId: string
  organizationId: string
  message: string
  status: ContactRequestStatus
  createdAt: string
  hrName?: string
  organizationName?: string
}

export interface CandidateShortlist {
  id: string
  hrUserId: string
  candidateId: string
  organizationId: string
  createdAt: string
}

/** Curated hubs a job can appear in (services 28, 29). */
export type OpportunityTrack = 'internship' | 'graduate' | 'ngo'

export interface Job {
  id: string
  title: string
  description: string
  requirements: string[]
  experienceLevel: string | null
  location: string
  jobType: string
  status: JobStatus
  createdBy: string
  createdAt: string
  /** Owning HR organization, for the verified-employer badge and matching. */
  organizationId?: string | null
  organizationName?: string | null
  /** Service 27: only verified candidates can see or apply to these. */
  isExclusive?: boolean
  tracks?: OpportunityTrack[]
  /** Denormalised from the organization for candidate-facing lists. */
  employerVerified?: boolean
}

export interface JobApplication {
  id: string
  jobId: string
  candidateId: string
  cvUrl: string | null
  message: string | null
  status: ApplicationStatus
  createdAt: string
  candidate?: CandidateRecord | null
}

/** One of the candidate's own applications, as shown back to them. */
export interface CandidateApplicationSummary {
  jobId: string
  status: ApplicationStatus
  createdAt: string
}

export interface CandidateJobApplicationContext {
  existingCvUrl: string | null
  existingCvName: string | null
  appliedJobIds: string[]
  /** Status of each application so the candidate can track the outcome. */
  applications: CandidateApplicationSummary[]
}

export interface CandidateSearchFilters {
  query?: string
  skills?: string[]
  location?: string
}

export interface VerificationQueueItem {
  userId: string
  fullName: string
  email: string
  avatarUrl: string | null
  headline: string | null
  location: string | null
  bio: string | null
  linkedinUrl: string | null
  verificationStatus: VerificationStatus
  documentCount: number
  updatedAt: string
}

export interface AdminStats {
  pendingVerifications: number
  pendingHrOrgs: number
  verifiedCandidates: number
  totalCandidates: number
}

export interface CvEvaluationResult {
  matchScore: number
  strengths: string[]
  weaknesses: string[]
  missingSkills: string[]
  careerSuggestions: string[]
}

export interface UsageLimit {
  userId: string
  feature: UsageFeature
  count: number
  updatedAt: string
}

export const CV_EVALUATION_FREE_LIMIT = 2
