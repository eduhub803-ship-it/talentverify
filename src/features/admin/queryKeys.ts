import type { QueryClient } from '@tanstack/react-query'

export const adminQueryKeys = {
  root: ['admin'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  verificationQueue: ['admin', 'verification-queue'] as const,
  hrPending: ['admin', 'hr-pending'] as const,
  hrApprovals: ['admin', 'hr-approvals'] as const,
  relationships: ['admin', 'relationships'] as const,
  activity: ['admin', 'activity'] as const,
  candidates: ['admin', 'candidates'] as const,
  organizations: ['admin', 'organizations'] as const,
  candidateDirectory: ['admin', 'candidate-directory'] as const,
  importedCandidates: ['admin', 'imported-candidates'] as const,
  importBatches: ['admin', 'import-batches'] as const,
}

export function invalidateAdminWorkspace(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: adminQueryKeys.root }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.verificationQueue }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.hrPending }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.hrApprovals }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.relationships }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.activity }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.candidates }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.organizations }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.candidateDirectory }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.importedCandidates }),
    qc.invalidateQueries({ queryKey: adminQueryKeys.importBatches }),
  ])
}
