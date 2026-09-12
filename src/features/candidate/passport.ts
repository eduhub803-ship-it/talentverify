import type { CandidateCareerPreferences, CandidateProfile, TalentDocument } from '@/types/domain'

export type PassportSectionKey =
  | 'professional'
  | 'skills'
  | 'career'
  | 'background'
  | 'documents'

export interface PassportSectionStatus {
  key: PassportSectionKey
  label: string
  complete: boolean
  missing: string[]
}

export interface PassportCompletion {
  percent: number
  sections: PassportSectionStatus[]
  missingRequired: string[]
  nextAction: string
  canSubmitForVerification: boolean
}

export const emptyCareerPreferences: CandidateCareerPreferences = {
  openToWork: true,
  employmentTypes: [],
  preferredFields: [],
  preferredLocations: [],
  remotePreference: 'flexible',
  availabilityTiming: 'immediate',
}

export function normalizeStringList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function calculatePassportCompletion(
  profile: CandidateProfile | null | undefined,
  documents: TalentDocument[],
): PassportCompletion {
  const hasCv = documents.some((document) => document.type === 'cv')
  const prefs = profile?.careerPreferences ?? emptyCareerPreferences
  const skillCount = profile?.structuredSkills.length || profile?.skills.length || 0
  const hasBackground = Boolean(profile?.education.length || profile?.experience.length)

  const sections: PassportSectionStatus[] = [
    {
      key: 'professional',
      label: 'Professional profile',
      complete: Boolean(profile?.headline && profile.bio && profile.location),
      missing: [
        !profile?.headline ? 'professional headline' : '',
        !profile?.bio ? 'professional summary' : '',
        !profile?.location ? 'location' : '',
      ].filter(Boolean),
    },
    {
      key: 'skills',
      label: 'Skills',
      complete: skillCount > 0,
      missing: skillCount > 0 ? [] : ['at least one structured skill'],
    },
    {
      key: 'career',
      label: 'Career preferences',
      complete: Boolean(
        prefs.employmentTypes.length &&
          prefs.preferredFields.length &&
          prefs.preferredLocations.length &&
          prefs.availabilityTiming &&
          prefs.remotePreference,
      ),
      missing: [
        prefs.employmentTypes.length ? '' : 'employment type',
        prefs.preferredFields.length ? '' : 'preferred field',
        prefs.preferredLocations.length ? '' : 'preferred location',
      ].filter(Boolean),
    },
    {
      key: 'background',
      label: 'Education or experience',
      complete: hasBackground,
      missing: hasBackground ? [] : ['education or professional experience'],
    },
    {
      key: 'documents',
      label: 'CV',
      complete: hasCv,
      missing: hasCv ? [] : ['CV upload'],
    },
  ]

  const completeCount = sections.filter((section) => section.complete).length
  const missingRequired = sections.flatMap((section) => section.missing)

  return {
    percent: Math.round((completeCount / sections.length) * 100),
    sections,
    missingRequired,
    nextAction:
      sections.find((section) => !section.complete)?.label ?? 'Submit for verification',
    canSubmitForVerification: missingRequired.length === 0,
  }
}
