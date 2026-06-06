import { postCvEvaluation } from '@/api/ai/cv-evaluation'
import { evaluateCvAsRecruiter } from '@/server/evaluate-cv'
import type { CvEvaluationResult } from '@/types/domain'

export interface RunCvEvaluationParams {
  jobTitle: string
  jobDescription?: string
  candidateSkills: string[]
  candidateHeadline?: string | null
  candidateBio?: string | null
  experienceYears?: number | null
}

export const aiEvaluationService = {
  async evaluate(params: RunCvEvaluationParams): Promise<CvEvaluationResult> {
    try {
      return await postCvEvaluation({
        jobTitle: params.jobTitle,
        jobDescription: params.jobDescription,
        candidateSkills: params.candidateSkills,
        candidateHeadline: params.candidateHeadline,
        candidateBio: params.candidateBio,
        experienceYears: params.experienceYears,
      })
    } catch {
      // Fallback when API unavailable (e.g. static preview build)
      return evaluateCvAsRecruiter(params)
    }
  },
}
