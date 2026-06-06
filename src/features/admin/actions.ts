import { adminService } from './api/admin.service'
import type {
  AdminStats,
  HrOrganization,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain'

export function fetchAdminStats(): AdminStats {
  return adminService.getStats()
}

export function fetchVerificationQueue(): VerificationQueueItem[] {
  return adminService.getVerificationQueue()
}

export function reviewCandidateSubmission(
  userId: string,
  approved: boolean,
  notes?: string,
): void {
  const status: VerificationStatus = approved ? 'verified' : 'rejected'
  adminService.reviewCandidate(userId, status, notes)
}

export function fetchPendingHrOrganizations(): HrOrganization[] {
  return adminService.getPendingHrOrgs()
}

export function reviewHrOrganization(orgId: string, approved: boolean): void {
  adminService.reviewHrOrg(orgId, approved)
}
