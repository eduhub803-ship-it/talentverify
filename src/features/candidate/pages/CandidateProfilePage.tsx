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
  { key: 'professional', label: 'Professional profile' },
  { key: 'skills', label: 'Skills' },
  { key: 'career', label: 'Career preferences' },
  { key: 'background', label: 'Background' },
  { key: 'seh', label: 'SEH training & credentials' },
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
      setError(err instanceof Error ? err.message : 'This section could not be saved.')
    },
  })

  const savePatch = (patch: ProfilePatch) => {
    if (mutation.isPending) return
    setSaved(false)
    mutation.mutate(patch)
  }

  const saveProfessional = () => {
    const linkedin = profileDraft.linkedinUrl.trim()
    if (!profileDraft.headline.trim()) return setError('Headline is required.')
    if (profileDraft.headline.length > 120) return setError('Headline must be 120 characters or less.')
    if (profileDraft.bio.length > 2000) return setError('Summary must be 2000 characters or less.')
    if (linkedin && !/^https:\/\/(www\.)?linkedin\.com\//i.test(linkedin)) {
      return setError('Enter a valid LinkedIn URL.')
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
    if (!name) return setError('Skill name is required.')
    if (skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      return setError('That skill is already listed.')
    }
    const next = [...skills, { ...skillDraft, name }]
    setSkills(next)
    setSkillDraft(emptySkill())
    saveSkills(next)
  }

  const removeSkill = (id: string) => {
    if (!window.confirm('Remove this skill from your Talent Passport?')) return
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
      return setError('Complete the required fields before adding this item.')
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
    if (!window.confirm('Delete this item from your Talent Passport?')) return
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
                <p className="text-sm text-muted">SEH Talent ID</p>
                <p className="mt-1 text-xl font-semibold">{profile.sehTalentId ?? 'Assigned after save'}</p>
              </div>
              <Badge variant={profile.employerVisible ? 'success' : 'warning'}>
                {profile.employerVisible ? 'Visible to employers' : 'Hidden from employers'}
              </Badge>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-primary" style={{ width: `${completion.percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">
              Talent Passport {completion.percent}% complete. Next: {completion.nextAction}.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-semibold">Missing required information</h2>
            {completion.missingRequired.length === 0 ? (
              <p className="mt-2 text-sm text-success">Ready for verification submission.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {completion.missingRequired.map((item) => (
                  <li key={item}>{item}</li>
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
            {section.label}
          </Button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" />
          Saved.
        </p>
      )}

      {activeSection === 'professional' && (
        <Card>
          <CardBody className="space-y-5">
            <AvatarUpload />
            <Input label="Email" value={profile.profile?.email ?? ''} disabled readOnly />
            <Input label="Professional headline" value={profileDraft.headline} onChange={(event) => setProfileDraft({ ...profileDraft, headline: event.target.value })} />
            <Input label="Location" value={profileDraft.location} onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })} />
            <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/your-profile" value={profileDraft.linkedinUrl} onChange={(event) => setProfileDraft({ ...profileDraft, linkedinUrl: event.target.value })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Professional summary</label>
              <textarea className="min-h-[130px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={profileDraft.employerVisible} onChange={(event) => setProfileDraft({ ...profileDraft, employerVisible: event.target.checked })} />
              <span className="flex items-center gap-2">
                {profileDraft.employerVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Make my professional profile discoverable to approved employers
              </span>
            </label>
            <Button type="button" isLoading={mutation.isPending} onClick={saveProfessional}>Save professional profile</Button>
          </CardBody>
        </Card>
      )}

      {activeSection === 'skills' && (
        <Card>
          <CardBody className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
              <Input label="Skill name" value={skillDraft.name} onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })} />
              <Select label="Category" value={skillDraft.category} options={skillCategories} onChange={(value) => setSkillDraft({ ...skillDraft, category: value as SkillCategory })} />
              <Select label="Level" value={skillDraft.level ?? ''} options={skillLevels} onChange={(value) => setSkillDraft({ ...skillDraft, level: value as SkillLevel })} />
              <Button type="button" className="self-end" isLoading={mutation.isPending} onClick={addSkill}><Plus className="h-4 w-4" />Add</Button>
            </div>
            <ItemList items={skills} render={(skill) => `${skill.name} - ${skill.category}${skill.level ? ` - ${skill.level}` : ''}`} onDelete={removeSkill} />
          </CardBody>
        </Card>
      )}

      {activeSection === 'career' && (
        <Card>
          <CardBody className="space-y-5">
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={career.openToWork} onChange={(event) => setCareer({ ...career, openToWork: event.target.checked })} />Open to work</label>
            <Input label="Employment types" hint="Comma-separated" value={employmentTypesInput} onChange={(event) => setEmploymentTypesInput(event.target.value)} />
            <Input label="Preferred fields" hint="Comma-separated" value={fieldsInput} onChange={(event) => setFieldsInput(event.target.value)} />
            <Input label="Preferred locations" hint="Comma-separated" value={locationsInput} onChange={(event) => setLocationsInput(event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Remote preference" value={career.remotePreference} options={remotePreferences} onChange={(value) => setCareer({ ...career, remotePreference: value as RemotePreference })} />
              <Select label="Availability" value={career.availabilityTiming} options={availabilityOptions} onChange={(value) => setCareer({ ...career, availabilityTiming: value as AvailabilityTiming })} />
            </div>
            <Button type="button" isLoading={mutation.isPending} onClick={saveCareer}>Save career preferences</Button>
          </CardBody>
        </Card>
      )}

      {activeSection === 'background' && (
        <div className="grid gap-5">
          <PassportPanel title="Education">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Institution" value={educationDraft.institution} onChange={(event) => setEducationDraft({ ...educationDraft, institution: event.target.value })} />
              <Input label="Program" value={educationDraft.program} onChange={(event) => setEducationDraft({ ...educationDraft, program: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(educationDraft, ['institution', 'program'], education, setEducation, 'education', () => setEducationDraft(emptyEducation()))}>Add education</Button>
            <ItemList items={education} render={(item) => `${item.program}, ${item.institution}`} onDelete={(id) => removeItem(id, education, setEducation, 'education')} />
          </PassportPanel>

          <PassportPanel title="Experience">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Company" value={experienceDraft.company} onChange={(event) => setExperienceDraft({ ...experienceDraft, company: event.target.value })} />
              <Input label="Title" value={experienceDraft.title} onChange={(event) => setExperienceDraft({ ...experienceDraft, title: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(experienceDraft, ['company', 'title'], experience, setExperience, 'experience', () => setExperienceDraft(emptyExperience()))}>Add experience</Button>
            <ItemList items={experience} render={(item) => `${item.title}, ${item.company}`} onDelete={(id) => removeItem(id, experience, setExperience, 'experience')} />
          </PassportPanel>

          <PassportPanel title="Languages and projects">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input label="Language" value={languageDraft.name} onChange={(event) => setLanguageDraft({ ...languageDraft, name: event.target.value })} />
              <Select label="Level" value={languageDraft.level} options={skillLevels} onChange={(value) => setLanguageDraft({ ...languageDraft, level: value as SkillLevel })} />
              <Button type="button" size="sm" className="self-end" isLoading={mutation.isPending} onClick={() => addItem(languageDraft, ['name'], languages, setLanguages, 'languages', () => setLanguageDraft(emptyLanguage()))}>Add language</Button>
            </div>
            <ItemList items={languages} render={(item) => `${item.name} - ${item.level}`} onDelete={(id) => removeItem(id, languages, setLanguages, 'languages')} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Project name" value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
              <Input label="Project URL" value={projectDraft.url ?? ''} onChange={(event) => setProjectDraft({ ...projectDraft, url: event.target.value })} />
            </div>
            <Input label="Project description" value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} />
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(projectDraft, ['name', 'description'], projects, setProjects, 'projects', () => setProjectDraft(emptyProject()))}>Add project</Button>
            <ItemList items={projects} render={(item) => item.name} onDelete={(id) => removeItem(id, projects, setProjects, 'projects')} />
          </PassportPanel>
        </div>
      )}

      {activeSection === 'seh' && (
        <div className="grid gap-5">
          <PassportPanel title="SEH training records">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Program" value={trainingDraft.program} onChange={(event) => setTrainingDraft({ ...trainingDraft, program: event.target.value })} />
              <Input label="Provider" value={trainingDraft.provider} onChange={(event) => setTrainingDraft({ ...trainingDraft, provider: event.target.value })} />
              <Input label="Completion date" value={trainingDraft.completionDate ?? ''} onChange={(event) => setTrainingDraft({ ...trainingDraft, completionDate: event.target.value })} />
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={trainingDraft.verifiedBySeh} onChange={(event) => setTrainingDraft({ ...trainingDraft, verifiedBySeh: event.target.checked })} />Mark as SEH-verified training</label>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(trainingDraft, ['program', 'provider'], sehTraining, setSehTraining, 'sehTraining', () => setTrainingDraft(emptyTraining()))}>Add training</Button>
            <ItemList items={sehTraining} render={(item) => `${item.program} - ${item.provider}${item.verifiedBySeh ? ' - SEH verified' : ''}`} onDelete={(id) => removeItem(id, sehTraining, setSehTraining, 'sehTraining')} />
          </PassportPanel>

          <PassportPanel title="Credentials">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Credential" value={credentialDraft.name} onChange={(event) => setCredentialDraft({ ...credentialDraft, name: event.target.value })} />
              <Input label="Issuer" value={credentialDraft.issuer} onChange={(event) => setCredentialDraft({ ...credentialDraft, issuer: event.target.value })} />
              <Input label="Issue date" value={credentialDraft.issueDate ?? ''} onChange={(event) => setCredentialDraft({ ...credentialDraft, issueDate: event.target.value })} />
            </div>
            <Button type="button" size="sm" isLoading={mutation.isPending} onClick={() => addItem(credentialDraft, ['name', 'issuer'], credentials, setCredentials, 'credentials', () => setCredentialDraft(emptyCredential()))}>Add credential</Button>
            <ItemList items={credentials} render={(item) => `${item.name} - ${item.issuer}`} onDelete={(id) => removeItem(id, credentials, setCredentials, 'credentials')} />
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
  onChange,
}: {
  label: string
  value: string
  options: string[]
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
            {option}
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
  onDelete,
}: {
  items: T[]
  render: (item: T) => string
  onDelete: (id: string) => void
}) {
  if (!items.length) return <p className="text-sm text-muted">No items added yet.</p>
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>{render(item)}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </li>
      ))}
    </ul>
  )
}
