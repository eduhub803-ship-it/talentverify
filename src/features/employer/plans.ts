/**
 * Employer entitlements (services 32, 33 and 36).
 *
 * The single place plan capabilities are decided. Entitlements raise limits and
 * unlock services; they never relax candidate privacy, organization ownership
 * or HR approval, which are enforced separately.
 */
import type {
  EmployerEntitlements,
  EmployerPlan,
  EmployerPlanLimits,
  HrOrganization,
  PartnershipStatus,
} from '@/types/domain'

export const EMPLOYER_PLANS: EmployerPlan[] = ['free', 'pro', 'partner']

export const EMPLOYER_PLAN_LIMITS: Record<EmployerPlan, EmployerPlanLimits> = {
  free: {
    activeJobPosts: 3,
    searchResults: 10,
    shortlistSize: 10,
    matchedCandidates: 5,
  },
  pro: {
    activeJobPosts: null,
    searchResults: null,
    shortlistSize: null,
    matchedCandidates: null,
  },
  partner: {
    activeJobPosts: null,
    searchResults: null,
    shortlistSize: null,
    matchedCandidates: null,
  },
}

const ENTITLEMENTS: Record<EmployerPlan, Omit<EmployerEntitlements, 'limits'>> = {
  free: {
    talentRequests: false,
    recruitmentAssessment: false,
    advancedTalentSearch: false,
    prioritySupport: false,
    partnerBadge: false,
  },
  pro: {
    talentRequests: true,
    recruitmentAssessment: true,
    advancedTalentSearch: true,
    prioritySupport: false,
    partnerBadge: false,
  },
  partner: {
    talentRequests: true,
    recruitmentAssessment: true,
    advancedTalentSearch: true,
    prioritySupport: true,
    partnerBadge: true,
  },
}

export function planOf(organization: HrOrganization | null | undefined): EmployerPlan {
  const plan = organization?.plan
  return plan === 'pro' || plan === 'partner' ? plan : 'free'
}

/**
 * A partnership only confers partner entitlements while it is active. A pending,
 * inactive or expired partnership falls back to Pro so the organization is never
 * silently downgraded to Free mid-engagement.
 */
export function effectivePlanOf(
  organization: HrOrganization | null | undefined,
): EmployerPlan {
  const plan = planOf(organization)
  if (plan !== 'partner') return plan
  return partnershipActive(organization) ? 'partner' : 'pro'
}

export function partnershipActive(
  organization: HrOrganization | null | undefined,
): boolean {
  if (organization?.plan !== 'partner') return false
  if (organization.partnershipStatus !== 'active') return false
  const end = organization.partnershipEndDate
  if (end && new Date(end).getTime() < Date.now()) return false
  return true
}

export function partnershipStatusOf(
  organization: HrOrganization | null | undefined,
): PartnershipStatus | null {
  if (organization?.plan !== 'partner') return null
  const status = organization.partnershipStatus ?? 'pending'
  const end = organization.partnershipEndDate
  if (status === 'active' && end && new Date(end).getTime() < Date.now()) {
    return 'expired'
  }
  return status
}

export function entitlementsFor(
  organization: HrOrganization | null | undefined,
): EmployerEntitlements {
  const plan = effectivePlanOf(organization)
  return { limits: EMPLOYER_PLAN_LIMITS[plan], ...ENTITLEMENTS[plan] }
}

export function limitsFor(organization: HrOrganization | null | undefined): EmployerPlanLimits {
  return entitlementsFor(organization).limits
}

export interface QuotaState {
  limit: number | null
  used: number
  remaining: number | null
  reached: boolean
}

export function quota(used: number, limit: number | null): QuotaState {
  if (limit === null) {
    return { limit: null, used, remaining: null, reached: false }
  }
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    reached: used >= limit,
  }
}

/** Free plans see a capped result set; Pro and Partner see everything. */
export function applyResultCap<T>(items: T[], limit: number | null): T[] {
  return limit === null ? items : items.slice(0, limit)
}

export const EMPLOYER_PLAN_FEATURES: Record<EmployerPlan, { key: string }[]> = {
  free: [
    { key: 'employer.plan.feature.jobs3' },
    { key: 'employer.plan.feature.search10' },
    { key: 'employer.plan.feature.shortlist10' },
    { key: 'employer.plan.feature.matching5' },
  ],
  pro: [
    { key: 'employer.plan.feature.jobsUnlimited' },
    { key: 'employer.plan.feature.searchUnlimited' },
    { key: 'employer.plan.feature.shortlistUnlimited' },
    { key: 'employer.plan.feature.matchingUnlimited' },
    { key: 'employer.plan.feature.talentRequests' },
  ],
  partner: [
    { key: 'employer.plan.feature.jobsUnlimited' },
    { key: 'employer.plan.feature.searchUnlimited' },
    { key: 'employer.plan.feature.matchingUnlimited' },
    { key: 'employer.plan.feature.talentRequests' },
    { key: 'employer.plan.feature.assessment' },
    { key: 'employer.plan.feature.prioritySupport' },
    { key: 'employer.plan.feature.partnerBadge' },
  ],
}
