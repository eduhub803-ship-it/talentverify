export const careerServicesQueryKeys = {
  root: ['career-services'] as const,
  mine: (candidateId: string) => ['career-services', 'mine', candidateId] as const,
  queue: ['career-services', 'queue'] as const,
}
