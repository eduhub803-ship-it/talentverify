export type UserRole = 'candidate' | 'hr' | 'admin'

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

export type JobStatus = 'open' | 'closed'

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

/** HR-facing candidate directory (Supabase `candidates` table) */
export interface CandidateRecord {
  id: string
  name: string
  email: string
  cvUrl: string | null
  skills: string[]
  experienceYears: number | null
  education: string | null
  aiSummary: string | null
  jobMatchScore: number | null
  location: string | null
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
  headline: string | null
  location: string | null
  bio: string | null
  skills: string[]
  verificationStatus: VerificationStatus
  verifiedAt: string | null
  rejectionReason: string | null
  updatedAt: string
  profile?: Pick<Profile, 'fullName' | 'email' | 'avatarUrl'>
}

export interface HrOrganization {
  id: string
  name: string
  website: string | null
  industry: string | null
  status: HrOrgStatus
  approvedAt: string | null
  createdAt: string
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

export interface CandidateJobApplicationContext {
  existingCvUrl: string | null
  existingCvName: string | null
  appliedJobIds: string[]
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
  headline: string | null
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
