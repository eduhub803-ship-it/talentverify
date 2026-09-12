import { adminService } from './api/admin.service'
import {
  candidateImportService,
  type ImportCandidatesInput,
  type ImportCandidatesResult,
} from './api/candidate-import.service'
import type {
  AdminStats,
  CandidateDirectoryEntry,
  CandidateImportBatch,
  ImportedCandidate,
  HrOrganization,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain'

export function fetchAdminStats(): Promise<AdminStats> {
  return adminService.getStats()
}

export function fetchVerificationQueue(): Promise<VerificationQueueItem[]> {
  return adminService.getVerificationQueue()
}

export function reviewCandidateSubmission(
  userId: string,
  approved: boolean,
  notes?: string,
): Promise<void> {
  const status: VerificationStatus = approved ? 'verified' : 'rejected'
  return adminService.reviewCandidate(userId, status, notes)
}

export function fetchPendingHrOrganizations(): Promise<HrOrganization[]> {
  return adminService.getPendingHrOrgs()
}

export function fetchHrOrganizations(): Promise<HrOrganization[]> {
  return adminService.getHrOrgs()
}

export function reviewHrOrganization(
  orgId: string,
  approved: boolean,
): Promise<void> {
  return adminService.reviewHrOrg(orgId, approved)
}

export function fetchCandidateDirectory(): Promise<CandidateDirectoryEntry[]> {
  return candidateImportService.getDirectory()
}

export function importCandidates(
  input: ImportCandidatesInput,
): Promise<ImportCandidatesResult> {
  return candidateImportService.importCandidates(input)
}

export function fetchImportedCandidates(
  batchId?: string,
): Promise<ImportedCandidate[]> {
  return candidateImportService.listImportedCandidates(batchId)
}

export function fetchImportBatches(): Promise<CandidateImportBatch[]> {
  return candidateImportService.listImportBatches()
}
