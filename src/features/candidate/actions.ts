import { candidateService } from './api/candidate.service'
import { aiEvaluationService } from '@/services/ai-evaluation.service'
import { usageLimitsService } from '@/services/usage-limits.service'
import { candidatesService } from '@/services/candidates.service'
import { UsageLimitError } from '@/lib/errors'
import {
  CV_EVALUATION_FREE_LIMIT,
  type CandidateProfile,
  type ContactRequest,
  type CvEvaluationResult,
  type DocumentType,
  type TalentDocument,
  type UsageLimit,
} from '@/types/domain'

export async function fetchMyCandidateProfile(userId: string): Promise<CandidateProfile> {
  return candidateService.getMyProfile(userId)
}

export async function saveCandidateProfile(
  userId: string,
  data: {
    headline: string | null
    location: string | null
    bio: string | null
    skills: string[]
  },
): Promise<CandidateProfile> {
  const updated = await candidateService.updateProfile(userId, data)
  await candidatesService.syncFromProfile(userId)
  return updated
}

export async function fetchMyDocuments(userId: string): Promise<TalentDocument[]> {
  return candidateService.getDocuments(userId)
}

export async function uploadCandidateDocument(
  userId: string,
  file: File,
  type: DocumentType,
): Promise<TalentDocument> {
  const doc = await candidateService.uploadDocument(userId, file, type)
  await candidatesService.syncFromProfile(userId)
  return doc
}

export async function removeCandidateDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  await candidateService.deleteDocument(userId, documentId)
  await candidatesService.syncFromProfile(userId)
}

export async function submitCandidateForVerification(userId: string): Promise<void> {
  return candidateService.submitForVerification(userId)
}

export async function fetchContactRequests(userId: string): Promise<ContactRequest[]> {
  return candidateService.getContactRequests(userId)
}

export async function respondToContactRequest(
  userId: string,
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  return candidateService.respondToContact(userId, requestId, status)
}

export async function fetchCvEvaluationUsage(userId: string): Promise<UsageLimit> {
  return usageLimitsService.getUsage(userId, 'cv_evaluation')
}

export async function evaluateMyCv(
  userId: string,
  input: { jobTitle: string; jobDescription?: string },
): Promise<CvEvaluationResult> {
  const usage = await usageLimitsService.getUsage(userId, 'cv_evaluation')
  if (usage.count >= CV_EVALUATION_FREE_LIMIT) {
    throw new UsageLimitError()
  }

  const profile = await candidateService.getMyProfile(userId)
  const record = await candidatesService.getById(userId)

  const result = await aiEvaluationService.evaluate({
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    candidateSkills: profile.skills,
    candidateHeadline: profile.headline,
    candidateBio: profile.bio,
    experienceYears: record?.experienceYears ?? null,
  })

  await usageLimitsService.increment(userId, 'cv_evaluation')
  return result
}

export function getCvEvaluationRemaining(usage: UsageLimit): number {
  return Math.max(0, CV_EVALUATION_FREE_LIMIT - usage.count)
}
