import { useContext, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { AvatarUpload } from '@/features/profile/components/AvatarUpload'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchMyCandidateProfile, fetchMyDocuments, saveCandidateProfile } from '../actions'
import {
  calculatePassportCompletion,
  emptyCareerPreferences,
  normalizeStringList,
  translatePassportText,
  type PassportSectionKey,
} from '../passport'
import type {
  AvailabilityTiming,
  CandidateCredential,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateProfile,
  CandidateProject,
  CandidateSkill,
  CandidateTrainingRecord,
  RemotePreference,
  SkillCategory,
  SkillLevel,
} from '@/types/domain'

type EditableSection = PassportSectionKey | 'seh'
type ProfilePatch = Parameters<typeof saveCandidateProfile>[1]
type ListPatchKey = keyof Pick<
  CandidateProfile,
  'education' | 'experience' | 'languages' | 'projects' | 'sehTraining' | 'credentials'
>

const sections: { key: EditableSection; label: string }[] = [
  { key: 'professional', label: 'candidateProfile.section.professional' },
  { key: 'skills', label: 'candidateProfile.section.skills' },
  { key: 'career', label: 'candidateProfile.section.career' },
  { key: 'background', label: 'candidateProfile.section.background' },
  { key: 'seh', label: 'candidateProfile.section.seh' },
]

const skillCategories: SkillCategory[] = [
  'Management',
  'Digital',
  'AI',
  'Communication',
  'Technical',
  'Language',
  'Sector Specific',
]

const skillLevels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
const remotePreferences: RemotePreference[] = ['onsite', 'hybrid', 'remote', 'flexible']
const availabilityOptions: AvailabilityTiming[] = [
  'immediate',
  'two_weeks',
  'one_month',
  'more_than_one_month',
]

function newId() {
  return crypto.randomUUID()
}

function optionLabel(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return ''
  const key = `candidateProfile.option.${value}`
  const label = t(key)
  return label === key ? value : label
}

function emptySkill(): CandidateSkill {
  return { id: newId(), name: '', category: 'Technical', level: 'Intermediate' }
}

function emptyEducation(): CandidateEducation {
  return { id: newId(), institution: '', program: '', startYear: '', endYear: '' }
}

function emptyExperience(): CandidateExperience {
  return { id: newId(), company: '', title: '', startDate: '', endDate: '', description: '' }
}

function emptyLanguage(): CandidateLanguage {
  return { id: newId(), name: '', level: 'Intermediate' }
}

function emptyProject(): CandidateProject {
  return { id: newId(), name: '', description: '', url: '' }
}

function emptyTraining(): CandidateTrainingRecord {
  return { id: newId(), program: '', provider: 'SEH', completionDate: '', verifiedBySeh: false }
}

function emptyCredential(): CandidateCredential {
  return { id: newId(), name: '', issuer: '', issueDate: '', documentId: null }
}

export function CandidateProfilePage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [activeSection, setActiveSection] = useState<EditableSection>('professional')
  const [profileDraft, setProfileDraft] = useState({
    headline: '',
    location: '',
    bio: '',
    linkedinUrl: '',
    employerVisible: false,
  })
  const [skills, setSkills] = useState<CandidateSkill[]>([])
  const [skillDraft, setSkillDraft] = useState(emptySkill)
  const [career, setCareer] = useState(emptyCareerPreferences)
  const [employmentTypesInput, setEmploymentTypesInput] = useState('')
  const [fieldsInput, setFieldsInput] = useState('')
  const [locationsInput, setLocationsInput] = useState('')
  const [education, setEducation] = useState<CandidateEducation[]>([])
  const [experience, setExperience] = useState<CandidateExperience[]>([])
  const [languages, setLanguages] = useState<CandidateLanguage[]>([])
  const [projects, setProjects] = useState<CandidateProject[]>([])
  const [educationDraft, setEducationDraft] = useState(emptyEducation)
  const [experienceDraft, setExperienceDraft] = useState(emptyExperience)
  const [languageDraft, setLanguageDraft] = useState(emptyLanguage)
  const [projectDraft, setProjectDraft] = useState(emptyProject)
  const [sehTraining, setSehTraining] = useState<CandidateTrainingRecord[]>([])
  const [credentials, setCredentials] = useState<CandidateCredential[]>([])
  const [trainingDraft, setTrainingDraft] = useState(emptyTraining)
  const [credentialDraft, setCredentialDraft] = useState(emptyCredential)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate', 'profile', userId],
    queryFn: () => fetchMyCandidateProfile(userId),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  // Re-sync the editable drafts whenever a newer profile arrives (initial load
  // and after every save). Done during render rather than in an effect, which
  // avoids a cascading second render.
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  if (profile && profile.updatedAt !== syncedAt) {
    setSyncedAt(profile.updatedAt)
    setProfileDraft({
      headline: profile.headline ?? '',
      location: profile.location ?? '',
      bio: profile.bio ?? '',
      linkedinUrl: profile.linkedinUrl ?? '',
      employerVisible: profile.employerVisible,
    })
    setSkills(
      profile.structuredSkills.length
        ? profile.structuredSkills
        : profile.skills.map((name) => ({
            id: newId(),
            name,
            category: 'Technical',
            level: null,
          })),
    )
    setCareer(profile.careerPreferences)
    setEmploymentTypesInput(profile.careerPreferences.employmentTypes.join(', '))
    setFieldsInput(profile.careerPreferences.preferredFields.join(', '))
    setLocationsInput(profile.careerPreferences.preferredLocations.join(', '))
    setEducation(profile.education)
    setExperience(profile.experience)
    setLanguages(profile.languages)
    setProjects(profile.projects)
    setSehTraining(profile.sehTraining)
    setCredentials(profile.credentials)
  }

  const completion = useMemo(
    () => calculatePassportCompletion(profile, documents),
    [documents, profile],
  )

  const mutation = useMutation({
    mutationFn: (patch: ProfilePatch) => saveCandidateProfile(userId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', 'profile', userId] })
      qc.invalidateQueries({ queryKey: ['hr', 'search'] })
      setSaved(true)
      setError(null)
    },
    onError: (err) => {
      setSaved(false)
      setError(err instanceof Error ? err.message : t('candidateProfile.errorSave'))
    },
  })

  const savePatch = (patch: ProfilePatch) => {
    if (mutation.isPending) return
    setSaved(false)
    mutation.mutate(patch)
  }

  const saveProfessional = () => {
    const linkedin = profileDraft.linkedinUrl.trim()
    if (!profileDraft.headline.trim()) return setError(t('candidateProfile.errorHeadlineRequired'))
    if (profileDraft.headline.length > 120) return setError(t('candidateProfile.errorHeadlineLength'))
    if (profileDraft.bio.length > 2000) return setError(t('candidateProfile.errorSummaryLength'))
    if (linkedin && !/^https:\/\/(www\.)?linkedin\.com\//i.test(linkedin)) {
      return setError(t('candidateProfile.errorLinkedIn'))
    }
    savePatch({
      headline: profileDraft.headline.trim(),
      location: profileDraft.location.trim() || null,
      bio: profileDraft.bio.trim() || null,
      linkedinUrl: linkedin || null,
      employerVisible: profileDraft.employerVisible,
    })
  }

  const saveSkills = (nextSkills = skills) => {
    savePatch({
      structuredSkills: nextSkills,
      skills: nextSkills.map((skill) => skill.name),
    })
  }

  const addSkill = () => {
    const name = skillDraft.name.trim()
    if (!name) return setError(t('candidateProfile.errorSkillRequired'))
    if (skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      return setError(t('candidateProfile.errorSkillDuplicate'))
    }
    const next = [...skills, { ...skillDraft, name }]
    setSkills(next)
    setSkillDraft(emptySkill())
    saveSkills(next)
  }

  const removeSkill = (id: string) => {
    if (!window.confirm(t('candidateProfile.confirmRemoveSkill'))) return
    const next = skills.filter((skill) => skill.id !== id)
    setSkills(next)
    saveSkills(next)
  }

  const saveCareer = () => {
    savePatch({
      careerPreferences: {
        ...career,
        employmentTypes: normalizeStringList(employmentTypesInput),
        preferredFields: normalizeStringList(fieldsInput),
        preferredLocations: normalizeStringList(locationsInput),
      },
    })
  }

  const addItem = <T extends { id: string }>(
    item: T,
    required: (keyof T)[],
    current: T[],
    setCurrent: (value: T[]) => void,
    patchKey: ListPatchKey,
    resetDraft: () => void,
  ) => {
    if (required.some((key) => !String(item[key] ?? '').trim())) {
      return setError(t('validation.requiredFields'))
    }
    const next = [...current, item]
    setCurrent(next)
    resetDraft()
    savePatch({ [patchKey]: next })
  }

  const removeItem = <T extends { id: string }>(
    id: string,
    current: T[],
    setCurrent: (value: T[]) => void,
    patchKey: ListPatchKey,
  ) => {
    if (!window.confirm(t('candidateProfile.confirmDeleteItem'))) return
    const next = current.filter((item) => item.id !== id)
    setCurrent(next)
    savePatch({ [patchKey]: next })
  }

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('candidateProfile.title')}
        description={t('candidateProfile.description')}
        actions={<StatusBadge status={profile.verificationStatus} />}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">{t('candidateProfile.talentId')}</p>
                <p className="mt-1 text-xl font-semibold">
                  {profile.sehTalentId ?? t('candidateProfile.assignedAfterSave')}
                </p>
              </div>
              <Badge variant={profile.employerVisible ? 'success' : 'warning'}>
                {profile.employerVisible
                  ? t('candidateProfile.visibleToEmployers')
                  : t('candidateProfile.hiddenFromEmployers')}
              </Badge>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-primary" style={{ width: `${completion.percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {t('candidateProfile.passportComplete')
                .replace('{percent}', String(completion.percent))
                .replace('{nextAction}', translatePassportText(completion.nextAction, t))}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-semibold">{t('candidateProfile.missingRequired')}</h2>
            {completion.missingRequired.length === 0 ? (
              <p className="mt-2 text-sm text-success">
                {t('candidateProfile.readyForSubmission')}
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {completion.missingRequired.map((item) => (
                  <li key={item}>{translatePassportText(item, t)}</li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {sections.map((section) => (
          <Button
            key={section.key}
            type="button"
            size="sm"
            variant={activeSection === section.key ? 'primary' : 'secondary'}
            onClick={() => setActiveSection(section.key)}
          >
            {t(section.label)}
          </Button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" />
          {t('common.saved')}
        </p>
      )}

      {activeSection === 'professional' && (
        <Card>
          <CardBody className="space-y-5">
            <AvatarUpload />
            <Input label={t('candidateProfile.email')} value={profile.profile?.email ?? ''} disabled readOnly />
            <Input label={t('candidateProfile.professionalHeadline')} value={profileDraft.headline} onChange={(event) => setProfileDraft({ ...profileDraft, headline: event.target.value })} />
            <Input label={t('candidateProfile.location')} value={profileDraft.location} onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })} />
            <Input label={t('candidateProfile.linkedinUrl')} placeholder={t('candidateProfile.linkedinPlaceholder')} value={profileDraft.linkedinUrl} onChange={(event) => setProfileDraft({ ...profileDraft, linkedinUrl: event.target.value })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">{t('candidateProfile.summary')}</label>
              <textarea className="min-h-[130px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={profileDraft.employerVisible} onChange={(event) => setProfileDraft({ ...profileDraft, employerVisible: event.target.checked })} />
              <span className="flex items-center gap-2">
                {profileDraft.employerVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {t('candidateProfile.makeDiscoverable')}
              </span>
            </label>
            <Button type="button" isLoading={mutation.isPending} onClick={saveProfessional}>{t('candidateProfile.saveProfessional')}</Button>
          </CardBody>
        </Card>
      )}

      {activeSection === 'skills' && (
        <Card>
          <CardBody className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
              <Input label={t('candidateProfile.skillName')} value={skillDraft.name} onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })} />
              <Select label={t('candidateProfile.category')} value={skillDraft.category} options={skillCategories} t={t} onChange={(value) => setSkillDraft({ ...skillDraft, category: value as SkillCategory })} />
              <Select label={t('candidateProfile.level')} value={skillDraft.level ?? ''} options={skillLevels} t={t} onChange={(value) => setSkillDraft({ ...skillDraft, level: value as SkillLevel })} />
              <Button type="button" className="self-end" isLoading={mutation.isPending} onClick={addSkill}><Plus className="h-4 w-4" />{t('common.add')}</Button>
            </div>
            <ItemList items={skills} t={t} render={(skill) => `${skill.name} - ${optionLabel(skill.category, t)}${skill.level ? ` - ${optionLabel(skill.level, t)}` : ''}`} onDelete={removeSkill} />
          </CardBody>
        </Card>
      )}

      {activeSection === 'career' && (
        <Card>
          <CardBody className="space-y-5">
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={career.openToWork} onChange={(event) => setCareer({ ...career, openToWork: event.target.checked })} />{t('candidateProfile.openToWork')}</label>
            <Input label={t('candidateProfile.employmentTypes')} hint={t('candidateProfile.commaSeparated')} value={employmentTypesInput} onChange={(event) => setEmploymentTypesInput(event.target.value)} />
            <Input label={t('candidateProfile.preferredFields')} hint={t('candidateProfile.commaSeparated')} value={fieldsInput} onChange={(event) => setFieldsInput(event.target.value)} />
            <Input label={t('candidateProfile.preferredLocations')} hint={t('candidateProfile.commaSeparated')} value={locationsInput} onChange={(event) => setLocationsInput(event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label={t('candidateProfile.remotePreference')} value={career.remotePreference} options={remotePreferences} t={t} onChange={(value) => setCareer({ ...career, remotePreference: value as RemotePreference })} />
              <Select label={t('candidateProfile.availability')} value={career.availabilityTiming} options={availabilityOptions} t={t} onChange={(value) => setCareer({ ...career, availabilityTiming: value as AvailabilityTiming })} />
            </div>
            <Button type="button" isLoading={mutation.isPending} onClick={saveCareer}>{t('candidateProfile.saveCareer')}</Button>
          </CardBody>
        </Card>
      )}

      {activeSection === 'background' && (
        <div className="grid gap-5">
          <PassportPanel title={t('candidateProfile.education')}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label={t('candidateProfile.institution')} value={educationDraft.institution} onChange={(event) => setEducationDraft({ ...educationDraft, institution: event.target.value })} />
              <Input label={t('candidateProfile.program')} value={educationDraft.program} onChange={(event) => setEducationDraft({ ...educationDraft, program: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(educationDraft, ['institution', 'program'], education, setEducation, 'education', () => setEducationDraft(emptyEducation()))}>{t('candidateProfile.addEducation')}</Button>
            <ItemList items={education} t={t} render={(item) => `${item.program}, ${item.institution}`} onDelete={(id) => removeItem(id, education, setEducation, 'education')} />
          </PassportPanel>

          <PassportPanel title={t('candidateProfile.experience')}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label={t('candidateProfile.company')} value={experienceDraft.company} onChange={(event) => setExperienceDraft({ ...experienceDraft, company: event.target.value })} />
              <Input label={t('candidateProfile.jobTitle')} value={experienceDraft.title} onChange={(event) => setExperienceDraft({ ...experienceDraft, title: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(experienceDraft, ['company', 'title'], experience, setExperience, 'experience', () => setExperienceDraft(emptyExperience()))}>{t('candidateProfile.addExperience')}</Button>
            <ItemList items={experience} t={t} render={(item) => `${item.title}, ${item.company}`} onDelete={(id) => removeItem(id, experience, setExperience, 'experience')} />
          </PassportPanel>

          <PassportPanel title={t('candidateProfile.languagesProjects')}>
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input label={t('candidateProfile.language')} value={languageDraft.name} onChange={(event) => setLanguageDraft({ ...languageDraft, name: event.target.value })} />
              <Select label={t('candidateProfile.level')} value={languageDraft.level} options={skillLevels} t={t} onChange={(value) => setLanguageDraft({ ...languageDraft, level: value as SkillLevel })} />
              <Button type="button" size="sm" className="self-end" isLoading={mutation.isPending} onClick={() => addItem(languageDraft, ['name'], languages, setLanguages, 'languages', () => setLanguageDraft(emptyLanguage()))}>{t('candidateProfile.addLanguage')}</Button>
            </div>
            <ItemList items={languages} t={t} render={(item) => `${item.name} - ${optionLabel(item.level, t)}`} onDelete={(id) => removeItem(id, languages, setLanguages, 'languages')} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input label={t('candidateProfile.projectName')} value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
              <Input label={t('candidateProfile.projectUrl')} value={projectDraft.url ?? ''} onChange={(event) => setProjectDraft({ ...projectDraft, url: event.target.value })} />
            </div>
            <Input label={t('candidateProfile.projectDescription')} value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} />
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(projectDraft, ['name', 'description'], projects, setProjects, 'projects', () => setProjectDraft(emptyProject()))}>{t('candidateProfile.addProject')}</Button>
            <ItemList items={projects} t={t} render={(item) => item.name} onDelete={(id) => removeItem(id, projects, setProjects, 'projects')} />
          </PassportPanel>
        </div>
      )}

      {activeSection === 'seh' && (
        <div className="grid gap-5">
          <PassportPanel title={t('candidateProfile.trainingRecords')}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input label={t('candidateProfile.program')} value={trainingDraft.program} onChange={(event) => setTrainingDraft({ ...trainingDraft, program: event.target.value })} />
              <Input label={t('candidateProfile.provider')} value={trainingDraft.provider} onChange={(event) => setTrainingDraft({ ...trainingDraft, provider: event.target.value })} />
              <Input label={t('candidateProfile.completionDate')} value={trainingDraft.completionDate ?? ''} onChange={(event) => setTrainingDraft({ ...trainingDraft, completionDate: event.target.value })} />
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={trainingDraft.verifiedBySeh} onChange={(event) => setTrainingDraft({ ...trainingDraft, verifiedBySeh: event.target.checked })} />{t('candidateProfile.markSehVerified')}</label>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(trainingDraft, ['program', 'provider'], sehTraining, setSehTraining, 'sehTraining', () => setTrainingDraft(emptyTraining()))}>{t('candidateProfile.addTraining')}</Button>
            <ItemList items={sehTraining} t={t} render={(item) => `${item.program} - ${item.provider}${item.verifiedBySeh ? ` - ${t('candidateProfile.sehVerified')}` : ''}`} onDelete={(id) => removeItem(id, sehTraining, setSehTraining, 'sehTraining')} />
          </PassportPanel>

          <PassportPanel title={t('candidateProfile.credentials')}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input label={t('candidateProfile.credential')} value={credentialDraft.name} onChange={(event) => setCredentialDraft({ ...credentialDraft, name: event.target.value })} />
              <Input label={t('candidateProfile.issuer')} value={credentialDraft.issuer} onChange={(event) => setCredentialDraft({ ...credentialDraft, issuer: event.target.value })} />
              <Input label={t('candidateProfile.issueDate')} value={credentialDraft.issueDate ?? ''} onChange={(event) => setCredentialDraft({ ...credentialDraft, issueDate: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(credentialDraft, ['name', 'issuer'], credentials, setCredentials, 'credentials', () => setCredentialDraft(emptyCredential()))}>{t('candidateProfile.addCredential')}</Button>
            <ItemList items={credentials} t={t} render={(item) => `${item.name} - ${item.issuer}`} onDelete={(id) => removeItem(id, credentials, setCredentials, 'credentials')} />
          </PassportPanel>
        </div>
      )}
    </div>
  )
}

function Select({
  label,
  value,
  options,
  t,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  t: (key: string) => string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-foreground">
      <span className="block">{label}</span>
      <select
        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option, t)}
          </option>
        ))}
      </select>
    </label>
  )
}

function PassportPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </CardBody>
    </Card>
  )
}

function ItemList<T extends { id: string }>({
  items,
  render,
  t,
  onDelete,
}: {
  items: T[]
  render: (item: T) => string
  t: (key: string) => string
  onDelete: (id: string) => void
}) {
  if (!items.length) return <p className="text-sm text-muted">{t('candidateProfile.noItems')}</p>
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>{render(item)}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-4 w-4" />
            {t('common.delete')}
          </Button>
        </li>
      ))}
    </ul>
  )
}
