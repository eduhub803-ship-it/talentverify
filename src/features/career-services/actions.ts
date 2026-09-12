import { AuthorizationError } from '@/lib/errors'
import { isPlatformAdmin } from '@/features/auth/roles'
import type {
  CandidateProfile,
  CareerServicePaymentStatus,
  CareerServiceRequest,
  CareerServiceRequestStatus,
  CareerServiceResult,
  Profile,
  TalentDocument,
} from '@/types/domain'
import { careerServicesService } from './api/career-services.service'
import { requireCareerService } from './catalog'
import { computeSelfServiceResult, validateServiceInput } from './rules'

function assertCareerStaff(actor: Profile | null | undefined): Profile {
  if (!isPlatformAdmin(actor)) {
    throw new AuthorizationError('Only the career team can manage service requests.')
  }
  return actor
}

/**
 * Client-side mirror of the server's `auth.uid()` check: a candidate may only
 * ever act on their own requests. Supabase enforces the same rule inside the
 * definer routines and in RLS; this keeps Mock mode honest and gives the UI a
 * clear error instead of a silent no-op.
 */
function assertOwnCandidate(
  actor: Profile | null | undefined,
  candidateId: string,
): Profile {
  if (!actor || actor.role !== 'candidate') {
    throw new AuthorizationError('Only candidates can request career services.')
  }
  if (actor.id !== candidateId) {
    throw new AuthorizationError('You can only manage your own career service requests.')
  }
  return actor
}

export async function fetchMyCareerRequests(
  candidateId: string,
): Promise<CareerServiceRequest[]> {
  return careerServicesService.listForCandidate(candidateId)
}

/** Career team queue. HR and candidates are rejected before any read happens. */
export async function fetchCareerServiceQueue(
  actor: Profile | null,
): Promise<CareerServiceRequest[]> {
  assertCareerStaff(actor)
  return careerServicesService.listAll()
}

export async function requestCareerService(input: {
  actor: Profile | null
  candidateId: string
  serviceCode: string
  candidateInput: Record<string, string>
  candidateNotes?: string | null
}): Promise<CareerServiceRequest> {
  assertOwnCandidate(input.actor, input.candidateId)
  const service = requireCareerService(input.serviceCode)
  const validation = validateServiceInput(service, input.candidateInput)
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0])
  }
  return careerServicesService.create({
    candidateId: input.candidateId,
    serviceCode: input.serviceCode,
    candidateInput: input.candidateInput,
    candidateNotes: input.candidateNotes,
  })
}

/**
 * Free self-service assessments (07, 13, 19). Deterministic and transparent -
 * scored from stored Talent Passport state plus the candidate's own checklist,
 * and resolved on submission so they get the outcome immediately.
 */
export async function submitSelfServiceAssessment(input: {
  actor: Profile | null
  candidateId: string
  serviceCode: string
  answers: Record<string, string>
  profile: CandidateProfile | null | undefined
  documents: TalentDocument[]
}): Promise<CareerServiceRequest> {
  assertOwnCandidate(input.actor, input.candidateId)
  const service = requireCareerService(input.serviceCode)
  const validation = validateServiceInput(service, input.answers)
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0])
  }

  const result = computeSelfServiceResult(
    service,
    input.profile,
    input.documents,
    input.answers,
  )
  if (!result) {
    throw new Error('This service is not a self-service assessment.')
  }

  return careerServicesService.create({
    candidateId: input.candidateId,
    serviceCode: service.code,
    candidateInput: input.answers,
    result,
  })
}

export async function submitCareerRequestInformation(input: {
  actor: Profile | null
  requestId: string
  candidateId: string
  values: Record<string, string>
  notes?: string | null
}): Promise<CareerServiceRequest> {
  assertOwnCandidate(input.actor, input.candidateId)
  return careerServicesService.submitInformation(
    input.requestId,
    input.candidateId,
    input.values,
    input.notes,
  )
}

export async function cancelCareerServiceRequest(input: {
  actor: Profile | null
  requestId: string
  candidateId: string
}): Promise<CareerServiceRequest> {
  assertOwnCandidate(input.actor, input.candidateId)
  return careerServicesService.cancel(input.requestId, input.candidateId)
}

export async function applyCareerStaffTransition(input: {
  actor: Profile | null
  requestId: string
  status: CareerServiceRequestStatus
  scheduledAt?: string | null
  result?: CareerServiceResult | null
  adminMessage?: string | null
  internalNotes?: string | null
  paymentStatus?: CareerServicePaymentStatus
}): Promise<CareerServiceRequest> {
  const staff = assertCareerStaff(input.actor)
  return careerServicesService.applyStaffTransition({
    requestId: input.requestId,
    staffUserId: staff.id,
    status: input.status,
    scheduledAt: input.scheduledAt,
    result: input.result,
    adminMessage: input.adminMessage,
    internalNotes: input.internalNotes,
    paymentStatus: input.paymentStatus,
  })
}
