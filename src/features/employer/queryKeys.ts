export const employerQueryKeys = {
  root: ['employer'] as const,
  planUsage: (userId: string) => ['employer', 'plan-usage', userId] as const,
  alerts: (candidateId: string) => ['employer', 'alerts', candidateId] as const,
  matches: (jobId: string) => ['employer', 'matches', jobId] as const,
  myRequests: (userId: string) => ['employer', 'requests', userId] as const,
  queue: ['employer', 'queue'] as const,
  talentShortlist: (requestId: string) =>
    ['employer', 'talent-shortlist', requestId] as const,
  talentPool: (requestId: string) => ['employer', 'talent-pool', requestId] as const,
  organization: (organizationId: string) =>
    ['employer', 'organization-detail', organizationId] as const,
}
