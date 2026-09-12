import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CareerServicePaymentStatus,
  CareerServiceRequest,
  CareerServiceRequestStatus,
  CareerServiceResult,
} from '@/types/domain'
import { requireCareerService } from '../catalog'
import { assertTransition, candidateCanCancel } from '../rules'

export interface CreateCareerRequestInput {
  candidateId: string
  serviceCode: string
  candidateInput: Record<string, string>
  candidateNotes?: string | null
  result?: CareerServiceResult | null
}

export interface StaffTransitionInput {
  requestId: string
  staffUserId: string
  status: CareerServiceRequestStatus
  scheduledAt?: string | null
  result?: CareerServiceResult | null
  adminMessage?: string | null
  internalNotes?: string | null
  paymentStatus?: CareerServicePaymentStatus
}

interface CareerRequestRow {
  id: string
  candidate_id: string
  service_code: string
  status: CareerServiceRequestStatus
  payment_status: CareerServicePaymentStatus
  candidate_input: Record<string, string> | null
  candidate_notes: string | null
  admin_message: string | null
  assigned_to: string | null
  result: CareerServiceResult | null
  scheduled_at: string | null
  submitted_at: string
  completed_at: string | null
  updated_at: string
  candidate?: { full_name: string | null; email: string } | null
  assignee?: { full_name: string | null; email: string } | null
}

const SELECT_COLUMNS =
  '*, candidate:profiles!career_service_requests_candidate_id_fkey(full_name, email), assignee:profiles!career_service_requests_assigned_to_fkey(full_name, email)'

function mapRequest(row: CareerRequestRow): CareerServiceRequest {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    serviceCode: row.service_code,
    status: row.status,
    paymentStatus: row.payment_status,
    candidateInput: row.candidate_input ?? {},
    candidateNotes: row.candidate_notes,
    adminMessage: row.admin_message,
    // Internal notes live in an admin-only table; never part of a request read.
    internalNotes: null,
    assignedTo: row.assigned_to,
    assignedToName: row.assignee?.full_name ?? row.assignee?.email ?? null,
    result: row.result,
    scheduledAt: row.scheduled_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    candidateName: row.candidate?.full_name ?? row.candidate?.email ?? 'Candidate',
    candidateEmail: row.candidate?.email ?? '',
  }
}

/**
 * Notifications are written through the same table the rest of the product
 * uses. RLS forbids a client from addressing somebody else, so candidate-facing
 * notices raised by staff go through the `career_notify` RPC.
 */
async function notify(
  requestId: string,
  audience: 'candidate' | 'staff',
  type: string,
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' = 'normal',
): Promise<void> {
  const { error } = await supabase!.rpc('career_service_notify', {
    target_request_id: requestId,
    audience,
    notification_type: type,
    notification_title: title,
    notification_message: message,
    notification_priority: priority,
  })
  if (error) throw error
}

export const careerServicesService = {
  async listForCandidate(candidateId: string): Promise<CareerServiceRequest[]> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.listCareerServiceRequestsForCandidate(candidateId)
    }

    const { data, error } = await supabase
      .from('career_service_requests')
      .select(SELECT_COLUMNS)
      .eq('candidate_id', candidateId)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapRequest(row as unknown as CareerRequestRow))
  },

  /** Staff queue. Internal notes are attached here and only here. */
  async listAll(): Promise<CareerServiceRequest[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listCareerServiceRequests()

    const [{ data, error }, { data: notes, error: notesError }] = await Promise.all([
      supabase
        .from('career_service_requests')
        .select(SELECT_COLUMNS)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('career_service_internal_notes')
        .select('request_id, note, created_at')
        .order('created_at', { ascending: false }),
    ])
    if (error) throw error
    if (notesError) throw notesError

    const latestNote = new Map<string, string>()
    for (const note of notes ?? []) {
      const key = note.request_id as string
      if (!latestNote.has(key)) latestNote.set(key, note.note as string)
    }

    return (data ?? []).map((row) => {
      const request = mapRequest(row as unknown as CareerRequestRow)
      return { ...request, internalNotes: latestNote.get(request.id) ?? null }
    })
  },

  async getById(requestId: string): Promise<CareerServiceRequest | null> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.getCareerServiceRequest(requestId) ?? null
    }

    const { data, error } = await supabase
      .from('career_service_requests')
      .select(SELECT_COLUMNS)
      .eq('id', requestId)
      .maybeSingle()
    if (error) throw error
    return data ? mapRequest(data as unknown as CareerRequestRow) : null
  },

  /**
   * Creation always goes through the server. The Supabase path calls a
   * SECURITY DEFINER routine that derives candidate_id, status and
   * payment_status itself, so a crafted client payload cannot pick a workflow
   * state, an assignee, a payment state or a result.
   */
  async create(input: CreateCareerRequestInput): Promise<CareerServiceRequest> {
    const service = requireCareerService(input.serviceCode)
    if (!service.active) throw new Error('This service is not currently available.')

    if (!isSupabaseConfigured || !supabase) return mockDb.createCareerServiceRequest(input)

    const selfServiceResult = service.selfService ? (input.result ?? null) : null

    const { data: newId, error } = await supabase.rpc('career_service_create_request', {
      target_service_code: service.code,
      candidate_input_value: input.candidateInput,
      candidate_notes_value: input.candidateNotes ?? null,
      self_service_result: selfServiceResult,
    })
    if (error) throw error

    const created = await this.getById(newId as string)
    if (!created) throw new Error('Request could not be created.')

    if (created.status === 'completed') {
      await notify(
        created.id,
        'candidate',
        'career_service_completed',
        `${service.name} completed`,
        created.result?.summary ?? 'Your service is complete.',
      )
    } else {
      await notify(
        created.id,
        'candidate',
        'career_service_requested',
        'Service request received',
        `Your ${service.name} request was received.`,
      )
      await notify(
        created.id,
        'staff',
        'career_service_request',
        'New career service request',
        `${service.name} requested by a candidate.`,
      )
    }

    return created
  },

  async submitInformation(
    requestId: string,
    candidateId: string,
    input: Record<string, string>,
    notes?: string | null,
  ): Promise<CareerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.submitCareerRequestInformation(requestId, candidateId, input, notes)
    }

    const current = await this.getById(requestId)
    if (!current || current.candidateId !== candidateId) throw new Error('Request not found.')
    if (current.status !== 'waiting_candidate') {
      throw new Error('This request is not waiting for your information.')
    }
    assertTransition(current.status, 'in_progress')

    const service = requireCareerService(current.serviceCode)
    const { data, error } = await supabase
      .from('career_service_requests')
      .update({
        status: 'in_progress',
        candidate_input: { ...current.candidateInput, ...input },
        candidate_notes: notes?.trim() || current.candidateNotes,
        admin_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('candidate_id', candidateId)
      .select(SELECT_COLUMNS)
      .single()
    if (error) throw error

    await notify(
      requestId,
      'staff',
      'career_service_request',
      'Candidate provided information',
      `A candidate responded on their ${service.name} request.`,
    )
    return mapRequest(data as unknown as CareerRequestRow)
  },

  async cancel(requestId: string, candidateId: string): Promise<CareerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.cancelCareerServiceRequest(requestId, candidateId)
    }

    const current = await this.getById(requestId)
    if (!current || current.candidateId !== candidateId) throw new Error('Request not found.')
    if (!candidateCanCancel(current)) {
      throw new Error('This request can no longer be cancelled. Contact the career team.')
    }
    assertTransition(current.status, 'cancelled')

    const service = requireCareerService(current.serviceCode)
    const { data, error } = await supabase
      .from('career_service_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('candidate_id', candidateId)
      .select(SELECT_COLUMNS)
      .single()
    if (error) throw error

    await notify(
      requestId,
      'staff',
      'career_service_request',
      'Career service request cancelled',
      `A candidate cancelled their ${service.name} request.`,
    )
    return mapRequest(data as unknown as CareerRequestRow)
  },

  /**
   * Staff transition. The Supabase path runs a SECURITY DEFINER routine that
   * re-checks the admin role, re-validates the transition server-side and
   * raises the candidate notification in one transaction.
   */
  async applyStaffTransition(input: StaffTransitionInput): Promise<CareerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.updateCareerServiceRequest(input)
    }

    const current = await this.getById(input.requestId)
    if (!current) throw new Error('Request not found.')
    const service = requireCareerService(current.serviceCode)

    // Fail fast client-side with the same messages the mock produces.
    assertTransition(current.status, input.status)
    if (input.status === 'scheduled' && !input.scheduledAt) {
      throw new Error('Choose a date and time before scheduling this session.')
    }
    if (input.status === 'completed' && !input.result?.summary?.trim()) {
      throw new Error('Add the result before completing this request.')
    }
    if (input.status === 'waiting_candidate' && !input.adminMessage?.trim()) {
      throw new Error('Explain what the candidate needs to provide.')
    }

    const { error } = await supabase.rpc('career_service_apply_transition', {
      target_request_id: input.requestId,
      new_status: input.status,
      scheduled_at_value: input.scheduledAt ?? null,
      result_value: input.result ?? null,
      admin_message_value: input.adminMessage ?? null,
      internal_notes_value: input.internalNotes ?? null,
      payment_status_value: input.paymentStatus ?? null,
      service_name: service.name,
    })
    if (error) throw error

    const updated = await this.getById(input.requestId)
    if (!updated) throw new Error('Request not found.')
    return updated
  },
}
