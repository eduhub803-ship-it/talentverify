import { AuthorizationError } from '@/lib/errors'
import { isPlatformAdmin } from '@/features/auth/roles'
import { hrService } from '@/features/hr/api/hr.service'
import { jobsService } from '@/services/jobsService'
import { candidateService } from '@/features/candidate/api/candidate.service'
import type {
  CandidateJobMatch,
  PartnershipStatus,
  TalentRequestShortlistItem,
  CareerServiceRequestStatus,
  CareerServiceResult,
  EmployerPlan,
  EmployerServiceRequest,
  HrOrganization,
  Job,
  JobAlert,
  Profile,
} from '@/types/domain'
import { employerService } from './api/employer.service'
import { requireEmployerService } from './catalog'
import { matchCandidatesToJob } from './matching'
import { entitlementsFor, limitsFor, planOf, effectivePlanOf, quota } from './plans'
import { validateAlertDraft, type AlertDraft, splitCriteria } from './alerts'

function assertStaff(actor: Profile | null | undefined): Profile {
  if (!isPlatformAdmin(actor)) {
    throw new AuthorizationError('Only SEH staff can perform this action.')
  }
  return actor
}

function assertCandidate(actor: Profile | null | undefined, candidateId: string): Profile {
  if (!actor || actor.role !== 'candidate') {
    throw new AuthorizationError('Only candidates can manage job alerts.')
  }
  if (actor.id !== candidateId) {
    throw new AuthorizationError('You can only manage your own job alerts.')
  }
  return actor
}

/** HR actions require an approved organization, matching the existing HR rules. */
async function assertApprovedHr(actor: Profile | null | undefined) {
  if (!actor || actor.role !== 'hr') {
    throw new AuthorizationError('Only employer accounts can perform this action.')
  }
  const membership = await hrService.getMembership(actor.id)
  if (!membership?.organization || membership.organization.status !== 'approved') {
    throw new AuthorizationError(
      'Your organization must be verified before using employer services.',
    )
  }
  return membership
}

/* ------------------------------- organization ------------------------------ */

export async function fetchMyOrganization(
  actor: Profile | null,
): Promise<HrOrganization | null> {
  if (!actor || actor.role !== 'hr') return null
  const membership = await hrService.getMembership(actor.id)
  if (!membership) return null
  const organization = await employerService.getOrganization(membership.organizationId)
  if (!organization) return null
  // Internal partnership notes are staff-only and never leave the admin side.
  return { ...organization, partnershipNotes: null }
}

/** Staff read: keeps the internal partnership notes. */
export async function fetchOrganizationForStaff(
  actor: Profile | null,
  organizationId: string,
): Promise<HrOrganization | null> {
  assertStaff(actor)
  return employerService.getOrganization(organizationId)
}

export async function saveOrganizationProfile(input: {
  actor: Profile | null
  organizationId: string
  website: string | null
  industry: string | null
  description: string | null
  companySize: string | null
  location: string | null
  contactEmail: string | null
}): Promise<HrOrganization> {
  if (!input.actor || input.actor.role !== 'hr') {
    throw new AuthorizationError('Only employer accounts can edit an employer profile.')
  }
  const membership = await hrService.getMembership(input.actor.id)
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new AuthorizationError('You can only manage your own organization.')
  }
  if (input.website && !/^https?:\/\/.+\..+/i.test(input.website)) {
    throw new Error('Enter a valid website URL, including https://')
  }
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    throw new Error('Enter a valid contact email address.')
  }

  return employerService.updateOrganizationProfile(input.organizationId, input.actor.id, {
    website: input.website,
    industry: input.industry,
    description: input.description,
    companySize: input.companySize,
    location: input.location,
    contactEmail: input.contactEmail,
  })
}

export async function setEmployerPlan(input: {
  actor: Profile | null
  organizationId: string
  plan: EmployerPlan
}): Promise<HrOrganization> {
  const staff = assertStaff(input.actor)
  return employerService.setOrganizationPlan(input.organizationId, input.plan, staff.id)
}

export interface EmployerPlanUsage {
  organization: HrOrganization | null
  plan: EmployerPlan
  /** Plan actually in force: an inactive partnership falls back to Pro. */
  effectivePlan: EmployerPlan
  entitlements: ReturnType<typeof entitlementsFor>
  jobPosts: ReturnType<typeof quota>
}

export async function fetchEmployerPlanUsage(
  actor: Profile | null,
): Promise<EmployerPlanUsage> {
  const organization = await fetchMyOrganization(actor)
  if (!organization) {
    return {
      organization: null,
      plan: 'free',
      effectivePlan: 'free',
      entitlements: entitlementsFor(null),
      jobPosts: quota(0, 3),
    }
  }
  const used = await employerService.countActiveJobs(organization.id)
  return {
    organization,
    plan: planOf(organization),
    effectivePlan: effectivePlanOf(organization),
    entitlements: entitlementsFor(organization),
    jobPosts: quota(used, limitsFor(organization).activeJobPosts),
  }
}

/* --------------------------- partnership (36) ----------------------------- */

export async function setEmployerPartnership(input: {
  actor: Profile | null
  organizationId: string
  status: PartnershipStatus | null
  startDate: string | null
  endDate: string | null
  notes: string | null
}): Promise<HrOrganization> {
  const staff = assertStaff(input.actor)
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new Error('The partnership end date cannot be before the start date.')
  }
  return employerService.setOrganizationPartnership({
    organizationId: input.organizationId,
    staffUserId: staff.id,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    notes: input.notes,
  })
}

/* ------------------------- talent requests (34) --------------------------- */

/** Staff view of the working shortlist, submitted or not. */
export async function fetchTalentShortlistForStaff(input: {
  actor: Profile | null
  requestId: string
}): Promise<TalentRequestShortlistItem[]> {
  const staff = assertStaff(input.actor)
  return employerService.listTalentShortlistForStaff(input.requestId, staff.id)
}

/** Employer view: empty until SEH submits the shortlist. */
export async function fetchSubmittedTalentShortlist(input: {
  actor: Profile | null
  requestId: string
}): Promise<TalentRequestShortlistItem[]> {
  await assertApprovedHr(input.actor)
  return employerService.listSubmittedTalentShortlist(input.requestId, input.actor!.id)
}

export async function addTalentRequestCandidate(input: {
  actor: Profile | null
  requestId: string
  candidateId: string
  employerNote?: string | null
}): Promise<TalentRequestShortlistItem> {
  const staff = assertStaff(input.actor)
  return employerService.addTalentRequestCandidate({
    requestId: input.requestId,
    candidateId: input.candidateId,
    staffUserId: staff.id,
    employerNote: input.employerNote,
  })
}

export async function removeTalentRequestCandidate(input: {
  actor: Profile | null
  itemId: string
}): Promise<void> {
  const staff = assertStaff(input.actor)
  return employerService.removeTalentRequestCandidate(input.itemId, staff.id)
}

export async function submitTalentShortlist(input: {
  actor: Profile | null
  requestId: string
}): Promise<EmployerServiceRequest> {
  const staff = assertStaff(input.actor)
  return employerService.submitTalentShortlist(input.requestId, staff.id)
}

/**
 * Candidates SEH may still add to a talent shortlist: the existing verified +
 * employer-visible pool, minus anyone already on it.
 */
export async function fetchEligibleTalentPool(input: {
  actor: Profile | null
  requestId: string
}): Promise<CandidateJobMatch[]> {
  const staff = assertStaff(input.actor)
  const candidates = await hrService.searchCandidates({})
  const shortlisted = await employerService.listTalentShortlistForStaff(
    input.requestId,
    staff.id,
  )
  const taken = new Set(shortlisted.map((item) => item.candidateId))

  return candidates
    .filter((candidate) => !taken.has(candidate.userId))
    .map((candidate) => ({
      candidateId: candidate.userId,
      candidateName: candidate.profile?.fullName ?? 'Verified candidate',
      headline: candidate.headline,
      location: candidate.location,
      sehTalentId: candidate.sehTalentId ?? null,
      skills: candidate.skills,
      score: 0,
      matchedRequirements: [],
      missingRequirements: [],
      reasons: [],
      shortlisted: false,
    }))
}

/* --------------------------------- job hubs -------------------------------- */

export async function fetchJobsForCandidate(candidateId: string): Promise<Job[]> {
  return employerService.listOpenJobsForCandidate(candidateId)
}

/* -------------------------------- job alerts ------------------------------- */

export async function fetchMyJobAlerts(
  actor: Profile | null,
  candidateId: string,
): Promise<JobAlert[]> {
  assertCandidate(actor, candidateId)
  return employerService.listJobAlerts(candidateId)
}

export async function createJobAlert(input: {
  actor: Profile | null
  candidateId: string
  draft: AlertDraft
}): Promise<JobAlert> {
  assertCandidate(input.actor, input.candidateId)
  const validation = validateAlertDraft(input.draft)
  if (!validation.valid) throw new Error(validation.error ?? 'This alert is not valid.')

  return employerService.createJobAlert({
    candidateId: input.candidateId,
    name: input.draft.name,
    keywords: splitCriteria(input.draft.keywords),
    location: input.draft.location.trim() || null,
    jobTypes: splitCriteria(input.draft.jobTypes),
    tracks: input.draft.tracks,
    exclusiveOnly: input.draft.exclusiveOnly,
    frequency: input.draft.frequency,
  })
}

export async function setJobAlertActive(input: {
  actor: Profile | null
  candidateId: string
  alertId: string
  active: boolean
}): Promise<JobAlert> {
  assertCandidate(input.actor, input.candidateId)
  return employerService.setJobAlertActive(input.alertId, input.candidateId, input.active)
}

export async function deleteJobAlert(input: {
  actor: Profile | null
  candidateId: string
  alertId: string
}): Promise<void> {
  assertCandidate(input.actor, input.candidateId)
  return employerService.deleteJobAlert(input.alertId, input.candidateId)
}

/* ----------------------------- candidate matching -------------------------- */

/**
 * Service 34. The candidate pool comes from the existing verified +
 * employer-visible search, so matching cannot widen who an employer can see.
 */
export async function fetchJobMatches(input: {
  actor: Profile | null
  jobId: string
}): Promise<{ matches: CandidateJobMatch[]; total: number; limit: number | null }> {
  const membership = await assertApprovedHr(input.actor)
  const job = await jobsService.getJob(input.jobId)
  if (!job || job.createdBy !== input.actor!.id) {
    throw new Error('Job not found.')
  }

  const candidates = await hrService.searchCandidates({})
  const shortlistedIds = await hrService.listShortlistedCandidateIds(
    input.actor!.id,
    membership.organizationId,
  )
  const limit = limitsFor(membership.organization).matchedCandidates

  const all = matchCandidatesToJob({ job, candidates, shortlistedIds, limit: null })
  return {
    matches: limit === null ? all : all.slice(0, limit),
    total: all.length,
    limit,
  }
}

/* --------------------------- employer services 35/36 ----------------------- */

export async function fetchMyEmployerRequests(
  actor: Profile | null,
): Promise<EmployerServiceRequest[]> {
  const membership = await assertApprovedHr(actor)
  return employerService.listEmployerRequestsForOrganization(membership.organizationId)
}

export async function fetchEmployerServiceQueue(
  actor: Profile | null,
): Promise<EmployerServiceRequest[]> {
  assertStaff(actor)
  return employerService.listEmployerRequests()
}

export async function requestEmployerService(input: {
  actor: Profile | null
  serviceCode: string
  values: Record<string, string>
  notes?: string | null
}): Promise<EmployerServiceRequest> {
  const membership = await assertApprovedHr(input.actor)
  const service = requireEmployerService(input.serviceCode)

  for (const field of service.inputFields) {
    const value = (input.values[field.key] ?? '').trim()
    if (field.required && !value) {
      throw new Error(`${field.label} is required.`)
    }
    if (value && field.type === 'select' && field.options) {
      if (!field.options.some((option) => option.value === value)) {
        throw new Error(`Choose a valid option for ${field.label}.`)
      }
    }
  }

  return employerService.createEmployerRequest({
    organizationId: membership.organizationId,
    requestedBy: input.actor!.id,
    serviceCode: service.code,
    input: input.values,
    notes: input.notes,
  })
}

export async function cancelEmployerRequest(input: {
  actor: Profile | null
  requestId: string
}): Promise<EmployerServiceRequest> {
  await assertApprovedHr(input.actor)
  return employerService.cancelEmployerRequest(input.requestId, input.actor!.id)
}

export async function applyEmployerStaffTransition(input: {
  actor: Profile | null
  requestId: string
  status: CareerServiceRequestStatus
  scheduledAt?: string | null
  result?: CareerServiceResult | null
  adminMessage?: string | null
  internalNotes?: string | null
}): Promise<EmployerServiceRequest> {
  const staff = assertStaff(input.actor)
  return employerService.applyStaffTransition({
    requestId: input.requestId,
    staffUserId: staff.id,
    status: input.status,
    scheduledAt: input.scheduledAt,
    result: input.result,
    adminMessage: input.adminMessage,
    internalNotes: input.internalNotes,
  })
}

/** Used by the candidate jobs page to decide whether exclusive roles are shown. */
export async function fetchCandidateVerificationStatus(
  candidateId: string,
): Promise<string | undefined> {
  try {
    const profile = await candidateService.getMyProfile(candidateId)
    return profile.verificationStatus
  } catch {
    return undefined
  }
}
