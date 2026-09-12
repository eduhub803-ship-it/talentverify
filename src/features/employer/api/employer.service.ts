import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  PartnershipStatus,
  TalentRequestShortlistItem,
  CareerServiceRequestStatus,
  CareerServiceResult,
  EmployerPlan,
  EmployerServiceRequest,
  HrOrganization,
  Job,
  JobAlert,
} from '@/types/domain'
import { requireEmployerService } from '../catalog'

interface OrganizationRow {
  id: string
  name: string
  website: string | null
  industry: string | null
  status: HrOrganization['status']
  approved_at: string | null
  created_at: string
  description: string | null
  company_size: string | null
  location: string | null
  contact_email: string | null
  profile_submitted_at: string | null
  plan: EmployerPlan | null
  partnership_status: PartnershipStatus | null
  partnership_start_date: string | null
  partnership_end_date: string | null
  partnership_notes: string | null
}

interface JobAlertRow {
  id: string
  candidate_id: string
  name: string
  keywords: string[] | null
  location: string | null
  job_types: string[] | null
  tracks: JobAlert['tracks'] | null
  exclusive_only: boolean
  frequency: JobAlert['frequency']
  active: boolean
  created_at: string
  updated_at: string
  last_matched_at: string | null
  match_count: number | null
}

interface EmployerRequestRow {
  id: string
  organization_id: string
  requested_by: string
  service_code: string
  status: CareerServiceRequestStatus
  payment_status: EmployerServiceRequest['paymentStatus']
  input: Record<string, string> | null
  notes: string | null
  admin_message: string | null
  assigned_to: string | null
  result: CareerServiceResult | null
  scheduled_at: string | null
  submitted_at: string
  completed_at: string | null
  updated_at: string
  shortlist_submitted_at: string | null
  organization?: { name: string } | null
  requester?: { full_name: string | null; email: string } | null
  assignee?: { full_name: string | null; email: string } | null
}

function mapOrganization(row: OrganizationRow): HrOrganization {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    status: row.status,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    description: row.description,
    companySize: row.company_size,
    location: row.location,
    contactEmail: row.contact_email,
    profileSubmittedAt: row.profile_submitted_at,
    plan: row.plan ?? 'free',
    partnershipStatus: row.partnership_status,
    partnershipStartDate: row.partnership_start_date,
    partnershipEndDate: row.partnership_end_date,
    // Internal partnership notes are admin-only; the employer read strips them.
    partnershipNotes: row.partnership_notes,
  }
}

function mapAlert(row: JobAlertRow): JobAlert {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    name: row.name,
    keywords: row.keywords ?? [],
    location: row.location,
    jobTypes: row.job_types ?? [],
    tracks: row.tracks ?? [],
    exclusiveOnly: row.exclusive_only,
    frequency: row.frequency,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMatchedAt: row.last_matched_at,
    matchCount: row.match_count ?? 0,
  }
}

function mapEmployerRequest(row: EmployerRequestRow): EmployerServiceRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestedBy: row.requested_by,
    serviceCode: row.service_code,
    status: row.status,
    paymentStatus: row.payment_status,
    input: row.input ?? {},
    notes: row.notes,
    adminMessage: row.admin_message,
    // Internal notes live in an admin-only table, never on a request read.
    internalNotes: null,
    assignedTo: row.assigned_to,
    assignedToName: row.assignee?.full_name ?? row.assignee?.email ?? null,
    result: row.result,
    scheduledAt: row.scheduled_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    shortlistSubmittedAt: row.shortlist_submitted_at,
    organizationName: row.organization?.name ?? 'Organization',
    requestedByName: row.requester?.full_name ?? row.requester?.email ?? 'HR user',
  }
}

const EMPLOYER_REQUEST_SELECT =
  '*, organization:hr_organizations(name), requester:profiles!employer_service_requests_requested_by_fkey(full_name, email), assignee:profiles!employer_service_requests_assigned_to_fkey(full_name, email)'


function mapShortlistItem(row: Record<string, unknown>): TalentRequestShortlistItem {
  const candidate = row.candidate as { full_name?: string | null } | null
  const profile = row.profile as
    | { headline?: string | null; location?: string | null; seh_talent_id?: string | null; skills?: string[] | null }
    | null
  return {
    id: row.id as string,
    requestId: row.request_id as string,
    candidateId: row.candidate_id as string,
    employerNote: (row.employer_note as string | null) ?? null,
    rank: (row.rank as number) ?? 0,
    addedAt: row.added_at as string,
    addedBy: (row.added_by as string) ?? '',
    candidateName: candidate?.full_name ?? 'Candidate',
    headline: profile?.headline ?? null,
    location: profile?.location ?? null,
    sehTalentId: profile?.seh_talent_id ?? null,
    skills: profile?.skills ?? [],
  }
}

export const employerService = {
  /* ------------------------------ organization ----------------------------- */

  async getOrganization(organizationId: string): Promise<HrOrganization | null> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.getOrganization(organizationId) ?? null
    }
    const { data, error } = await supabase
      .from('hr_organizations')
      .select('*')
      .eq('id', organizationId)
      .maybeSingle()
    if (error) throw error
    return data ? mapOrganization(data as OrganizationRow) : null
  },

  async updateOrganizationProfile(
    organizationId: string,
    actorUserId: string,
    patch: {
      website?: string | null
      industry?: string | null
      description?: string | null
      companySize?: string | null
      location?: string | null
      contactEmail?: string | null
    },
  ): Promise<HrOrganization> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.updateOrganizationProfile(organizationId, actorUserId, patch)
    }
    const { data, error } = await supabase
      .from('hr_organizations')
      .update({
        website: patch.website,
        industry: patch.industry,
        description: patch.description,
        company_size: patch.companySize,
        location: patch.location,
        contact_email: patch.contactEmail,
        profile_submitted_at: new Date().toISOString(),
      })
      .eq('id', organizationId)
      .select()
      .single()
    if (error) throw error

    const { error: notifyError } = await supabase.rpc('notify_employer_profile_updated', {
      target_organization_id: organizationId,
    })
    if (notifyError) throw notifyError
    return mapOrganization(data as OrganizationRow)
  },

  /** Staff-only: enforced by RLS and re-checked in the RPC. */
  async setOrganizationPlan(
    organizationId: string,
    plan: EmployerPlan,
    actorUserId: string,
  ): Promise<HrOrganization> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.setOrganizationPlan(organizationId, plan, actorUserId)
    }
    const { error } = await supabase.rpc('admin_set_employer_plan', {
      target_organization_id: organizationId,
      new_plan: plan,
    })
    if (error) throw error
    const organization = await this.getOrganization(organizationId)
    if (!organization) throw new Error('Organization not found.')
    return organization
  },

  async countActiveJobs(organizationId: string): Promise<number> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.countActiveJobsForOrganization(organizationId)
    }
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['open', 'draft'])
    if (error) throw error
    return count ?? 0
  },

  /* -------------------------------- job hubs ------------------------------- */

  async listOpenJobsForCandidate(candidateId: string): Promise<Job[]> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.listOpenJobsForCandidate(candidateId)
    }
    // RLS hides exclusive roles from unverified candidates, so a plain read is
    // already privacy-safe here.
    const { data, error } = await supabase
      .from('jobs')
      .select('*, organization:hr_organizations(name, status)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      requirements: (row.requirements as string[]) ?? [],
      experienceLevel: (row.experience_level as string | null) ?? null,
      location: row.location as string,
      jobType: row.job_type as string,
      status: row.status as Job['status'],
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      organizationId: (row.organization_id as string | null) ?? null,
      organizationName:
        ((row.organization as { name?: string } | null)?.name as string | undefined) ?? null,
      employerVerified:
        (row.organization as { status?: string } | null)?.status === 'approved',
      isExclusive: Boolean(row.is_exclusive),
      tracks: (row.tracks as Job['tracks']) ?? [],
    }))
  },

  /* ------------------------------- job alerts ------------------------------ */

  async listJobAlerts(candidateId: string): Promise<JobAlert[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listJobAlerts(candidateId)
    const { data, error } = await supabase
      .from('job_alerts')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapAlert(row as JobAlertRow))
  },

  async createJobAlert(input: {
    candidateId: string
    name: string
    keywords: string[]
    location: string | null
    jobTypes: string[]
    tracks: JobAlert['tracks']
    exclusiveOnly: boolean
    frequency: JobAlert['frequency']
  }): Promise<JobAlert> {
    if (!isSupabaseConfigured || !supabase) return mockDb.createJobAlert(input)

    const existing = await this.listJobAlerts(input.candidateId)
    if (existing.length >= 5) {
      throw new Error('You can keep up to five job alerts. Delete one to add another.')
    }
    if (
      existing.some(
        (alert) => alert.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
      )
    ) {
      throw new Error('You already have an alert with that name.')
    }

    const { data, error } = await supabase
      .from('job_alerts')
      .insert({
        candidate_id: input.candidateId,
        name: input.name.trim(),
        keywords: input.keywords,
        location: input.location,
        job_types: input.jobTypes,
        tracks: input.tracks,
        exclusive_only: input.exclusiveOnly,
        frequency: input.frequency,
        active: true,
      })
      .select()
      .single()
    if (error) throw error
    return mapAlert(data as JobAlertRow)
  },

  async setJobAlertActive(
    alertId: string,
    candidateId: string,
    active: boolean,
  ): Promise<JobAlert> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.setJobAlertActive(alertId, candidateId, active)
    }
    const { data, error } = await supabase
      .from('job_alerts')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', alertId)
      .eq('candidate_id', candidateId)
      .select()
      .single()
    if (error) throw error
    return mapAlert(data as JobAlertRow)
  },

  async deleteJobAlert(alertId: string, candidateId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.deleteJobAlert(alertId, candidateId)
      return
    }
    const { error } = await supabase
      .from('job_alerts')
      .delete()
      .eq('id', alertId)
      .eq('candidate_id', candidateId)
    if (error) throw error
  },

  /* -------------------------- employer service requests -------------------- */

  async listEmployerRequests(): Promise<EmployerServiceRequest[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listEmployerServiceRequests()
    const { data, error } = await supabase
      .from('employer_service_requests')
      .select(EMPLOYER_REQUEST_SELECT)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapEmployerRequest(row as unknown as EmployerRequestRow))
  },

  async listEmployerRequestsForOrganization(
    organizationId: string,
  ): Promise<EmployerServiceRequest[]> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.listEmployerServiceRequestsForOrganization(organizationId)
    }
    const { data, error } = await supabase
      .from('employer_service_requests')
      .select(EMPLOYER_REQUEST_SELECT)
      .eq('organization_id', organizationId)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapEmployerRequest(row as unknown as EmployerRequestRow))
  },

  async createEmployerRequest(input: {
    organizationId: string
    requestedBy: string
    serviceCode: string
    input: Record<string, string>
    notes?: string | null
  }): Promise<EmployerServiceRequest> {
    const service = requireEmployerService(input.serviceCode)
    if (!service.active) throw new Error('This service is not currently available.')

    if (!isSupabaseConfigured || !supabase) {
      return mockDb.createEmployerServiceRequest(input)
    }

    // The server derives organization, status and payment state.
    const { data: newId, error } = await supabase.rpc('employer_service_create_request', {
      target_service_code: service.code,
      input_value: input.input,
      notes_value: input.notes ?? null,
    })
    if (error) throw error

    const created = (await this.listEmployerRequestsForOrganization(
      input.organizationId,
    )).find((request) => request.id === newId)
    if (!created) throw new Error('Request could not be created.')
    return created
  },

  async cancelEmployerRequest(
    requestId: string,
    actorUserId: string,
  ): Promise<EmployerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.cancelEmployerServiceRequest(requestId, actorUserId)
    }
    const { error } = await supabase.rpc('employer_service_cancel_request', {
      target_request_id: requestId,
    })
    if (error) throw error
    const { data, error: readError } = await supabase
      .from('employer_service_requests')
      .select(EMPLOYER_REQUEST_SELECT)
      .eq('id', requestId)
      .single()
    if (readError) throw readError
    return mapEmployerRequest(data as unknown as EmployerRequestRow)
  },


  /* ------------------------ talent request shortlist ------------------------ */

  async addTalentRequestCandidate(input: {
    requestId: string
    candidateId: string
    staffUserId: string
    employerNote?: string | null
  }): Promise<TalentRequestShortlistItem> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.addTalentRequestCandidate(input)
    }
    const { data, error } = await supabase.rpc('talent_request_add_candidate', {
      target_request_id: input.requestId,
      target_candidate_id: input.candidateId,
      employer_note_value: input.employerNote ?? null,
    })
    if (error) throw error
    const items = await this.listTalentShortlistForStaff(input.requestId, input.staffUserId)
    const created = items.find((item) => item.id === data)
    if (!created) throw new Error('Candidate could not be shortlisted.')
    return created
  },

  async removeTalentRequestCandidate(itemId: string, staffUserId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.removeTalentRequestCandidate(itemId, staffUserId)
      return
    }
    const { error } = await supabase.rpc('talent_request_remove_candidate', {
      target_item_id: itemId,
    })
    if (error) throw error
  },

  async listTalentShortlistForStaff(
    requestId: string,
    staffUserId: string,
  ): Promise<TalentRequestShortlistItem[]> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.listTalentRequestShortlist(requestId, staffUserId)
    }
    const { data, error } = await supabase
      .from('talent_request_shortlists')
      .select(
        '*, candidate:profiles!talent_request_shortlists_candidate_id_fkey(full_name), profile:candidate_profiles!talent_request_shortlists_candidate_id_fkey(headline, location, seh_talent_id, skills)',
      )
      .eq('request_id', requestId)
      .order('rank', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => mapShortlistItem(row as Record<string, unknown>))
  },

  /** RLS returns nothing until the parent request has been submitted. */
  async listSubmittedTalentShortlist(
    requestId: string,
    hrUserId: string,
  ): Promise<TalentRequestShortlistItem[]> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.listSubmittedTalentShortlist(requestId, hrUserId)
    }
    const { data, error } = await supabase
      .from('talent_request_shortlists')
      .select(
        '*, candidate:profiles!talent_request_shortlists_candidate_id_fkey(full_name), profile:candidate_profiles!talent_request_shortlists_candidate_id_fkey(headline, location, seh_talent_id, skills)',
      )
      .eq('request_id', requestId)
      .order('rank', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => mapShortlistItem(row as Record<string, unknown>))
  },

  async submitTalentShortlist(
    requestId: string,
    staffUserId: string,
  ): Promise<EmployerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.submitTalentRequestShortlist(requestId, staffUserId)
    }
    const { error } = await supabase.rpc('talent_request_submit_shortlist', {
      target_request_id: requestId,
    })
    if (error) throw error
    const { data, error: readError } = await supabase
      .from('employer_service_requests')
      .select(EMPLOYER_REQUEST_SELECT)
      .eq('id', requestId)
      .single()
    if (readError) throw readError
    return mapEmployerRequest(data as unknown as EmployerRequestRow)
  },

  async setOrganizationPartnership(input: {
    organizationId: string
    staffUserId: string
    status: PartnershipStatus | null
    startDate: string | null
    endDate: string | null
    notes: string | null
  }): Promise<HrOrganization> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.setOrganizationPartnership(input)
    }
    const { error } = await supabase.rpc('admin_set_employer_partnership', {
      target_organization_id: input.organizationId,
      new_status: input.status,
      start_date_value: input.startDate,
      end_date_value: input.endDate,
      notes_value: input.notes,
    })
    if (error) throw error
    const organization = await this.getOrganization(input.organizationId)
    if (!organization) throw new Error('Organization not found.')
    return organization
  },

  async applyStaffTransition(input: {
    requestId: string
    staffUserId: string
    status: CareerServiceRequestStatus
    scheduledAt?: string | null
    result?: CareerServiceResult | null
    adminMessage?: string | null
    internalNotes?: string | null
  }): Promise<EmployerServiceRequest> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.updateEmployerServiceRequest(input)
    }
    const { error } = await supabase.rpc('employer_service_apply_transition', {
      target_request_id: input.requestId,
      new_status: input.status,
      scheduled_at_value: input.scheduledAt ?? null,
      result_value: input.result ?? null,
      admin_message_value: input.adminMessage ?? null,
      internal_notes_value: input.internalNotes ?? null,
    })
    if (error) throw error

    const { data, error: readError } = await supabase
      .from('employer_service_requests')
      .select(EMPLOYER_REQUEST_SELECT)
      .eq('id', input.requestId)
      .single()
    if (readError) throw readError
    return mapEmployerRequest(data as unknown as EmployerRequestRow)
  },
}
