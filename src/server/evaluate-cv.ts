import type { CvEvaluationResult } from '../types/domain'

export interface EvaluateCvInput {
  jobTitle: string
  jobDescription?: string
  candidateSkills: string[]
  candidateHeadline?: string | null
  candidateBio?: string | null
  experienceYears?: number | null
}

/** Recruiter-style evaluation (mock AI). Replace with OpenAI/Anthropic in production API handler. */
export function evaluateCvAsRecruiter(input: EvaluateCvInput): CvEvaluationResult {
  const title = input.jobTitle.toLowerCase()
  const desc = (input.jobDescription ?? '').toLowerCase()
  const corpus = `${title} ${desc}`
  const skillTokens = extractSkillTokens(corpus)

  const normalizedCandidate = input.candidateSkills.map((s) => s.toLowerCase())
  const matched = skillTokens.filter((t) =>
    normalizedCandidate.some((c) => c.includes(t) || t.includes(c)),
  )
  const missing = skillTokens.filter(
    (t) => !normalizedCandidate.some((c) => c.includes(t) || t.includes(c)),
  )

  const baseScore =
    skillTokens.length === 0
      ? 72
      : Math.round((matched.length / skillTokens.length) * 100)

  const experienceBonus = Math.min((input.experienceYears ?? 0) * 2, 10)
  const matchScore = Math.min(100, Math.max(35, baseScore + experienceBonus))

  const strengths: string[] = []
  if (matched.length > 0) {
    strengths.push(`Strong alignment on: ${matched.slice(0, 4).join(', ')}.`)
  }
  if (input.candidateHeadline) {
    strengths.push(`Relevant headline for ${input.jobTitle}: "${input.candidateHeadline}".`)
  }
  if ((input.experienceYears ?? 0) >= 5) {
    strengths.push(`${input.experienceYears} years of experience supports senior-level expectations.`)
  }
  if (strengths.length === 0) {
    strengths.push('Foundational profile present; role fit can improve with targeted upskilling.')
  }

  const weaknesses: string[] = []
  if (missing.length > 0) {
    weaknesses.push(`Gap in required areas: ${missing.slice(0, 4).join(', ')}.`)
  }
  if (!input.candidateBio?.trim()) {
    weaknesses.push('Professional summary is thin — impact and outcomes are hard to assess.')
  }
  if ((input.experienceYears ?? 0) < 2 && title.includes('senior')) {
    weaknesses.push('Experience level may be below typical senior requirements.')
  }
  if (weaknesses.length === 0) {
    weaknesses.push('Minor polish needed on storytelling and quantified achievements.')
  }

  const careerSuggestions = [
    `Tailor your CV headline and summary explicitly to "${input.jobTitle}".`,
    'Add 2–3 bullet points with measurable outcomes (%, $, time saved).',
    missing.length > 0
      ? `Close skill gaps via projects or certs in: ${missing.slice(0, 3).join(', ')}.`
      : 'Highlight leadership and cross-functional collaboration examples.',
    'Mirror keywords from the job description in your skills and experience sections.',
  ]

  return {
    matchScore,
    strengths,
    weaknesses,
    missingSkills: missing.slice(0, 8),
    careerSuggestions,
  }
}

function extractSkillTokens(text: string): string[] {
  const common = [
    'react',
    'typescript',
    'javascript',
    'node',
    'python',
    'aws',
    'docker',
    'kubernetes',
    'sql',
    'postgresql',
    'figma',
    'ux',
    'leadership',
    'agile',
    'java',
    'terraform',
    'communication',
  ]
  return common.filter((s) => text.includes(s))
}
