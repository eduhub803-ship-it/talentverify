import { hrService } from './api/hr.service'
import { candidatesService } from '@/services/candidates.service'
import { AuthorizationError } from '@/lib/errors'
import type {
  CandidateProfile,
  CandidateRecord,
  CandidateSearchFilters,
  ContactRequest,
  HrMember,
} from '@/types/domain'

export async function fetchHrMembership(userId: string): Promise<HrMember | null> {
  return hrService.getMembership(userId)
}

export async function assertHrOrgApproved(userId: string): Promise<HrMember> {
  const membership = await hrService.getMembership(userId)
  if (!membership?.organization || membership.organization.status !== 'approved') {
    throw new AuthorizationError(
      'Your organization must be approved before accessing candidate profiles.',
    )
  }
  return membership
}

export async function searchVerifiedCandidates(
  hrUserId: string,
  filters: CandidateSearchFilters,
): Promise<CandidateProfile[]> {
  await assertHrOrgApproved(hrUserId)
  return hrService.searchCandidates(filters)
}

export async function fetchCandidateFullProfile(
  hrUserId: string,
  candidateId: string,
): Promise<CandidateRecord> {
  await assertHrOrgApproved(hrUserId)
  const record = await candidatesService.getById(candidateId)
  if (!record) {
    throw new Error('Candidate not found.')
  }
  const verified = await hrService.getVerifiedCandidate(candidateId)
  if (!verified) {
    throw new AuthorizationError('This candidate is not verified.')
  }
  return record
}

export async function sendHrContactRequest(input: {
  hrUserId: string
  candidateId: string
  organizationId: string
  message: string
}): Promise<ContactRequest> {
  await assertHrOrgApproved(input.hrUserId)
  return hrService.sendContactRequest(input)
}

export async function fetchShortlistedCandidateIds(hrUserId: string): Promise<string[]> {
  const membership = await assertHrOrgApproved(hrUserId)
  return hrService.listShortlistedCandidateIds(hrUserId, membership.organizationId)
}

export async function toggleCandidateShortlist(input: {
  hrUserId: string
  candidateId: string
}): Promise<{ shortlisted: boolean }> {
  const membership = await assertHrOrgApproved(input.hrUserId)
  return hrService.toggleShortlist({
    ...input,
    organizationId: membership.organizationId,
  })
}

export function getCvDownloadUrl(record: CandidateRecord): string | null {
  return record.cvUrl
}
