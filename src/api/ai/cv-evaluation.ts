import type { CvEvaluationResult } from '@/types/domain'

export interface CvEvaluationRequest {
  jobTitle: string
  jobDescription?: string
  candidateSkills: string[]
  candidateHeadline?: string | null
  candidateBio?: string | null
  experienceYears?: number | null
}

export async function postCvEvaluation(
  body: CvEvaluationRequest,
): Promise<CvEvaluationResult> {
  const res = await fetch('/api/ai/cv-evaluation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Evaluation failed (${res.status})`)
  }

  return res.json() as Promise<CvEvaluationResult>
}
