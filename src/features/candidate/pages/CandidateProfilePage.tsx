import { useContext, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchMyCandidateProfile, saveCandidateProfile } from '../actions'
import {
  candidateProfileSchema,
  type CandidateProfileForm,
} from '@/features/profile/schemas/profile.schema'

export function CandidateProfilePage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const [skills, setSkills] = useState<string[]>([])
  const [initialSkills, setInitialSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate', 'profile', userId],
    queryFn: () => fetchMyCandidateProfile(userId),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CandidateProfileForm>({
    resolver: zodResolver(candidateProfileSchema),
  })

  useEffect(() => {
    if (profile) {
      reset({
        headline: profile.headline ?? '',
        location: profile.location ?? '',
        bio: profile.bio ?? '',
      })
      setSkills(profile.skills)
      setInitialSkills(profile.skills)
    }
  }, [profile, reset])

  const skillsDirty =
    skills.length !== initialSkills.length ||
    skills.some((s, i) => s !== initialSkills[i])

  const mutation = useMutation({
    mutationFn: (data: CandidateProfileForm) =>
      saveCandidateProfile(userId, {
        headline: data.headline || null,
        location: data.location || null,
        bio: data.bio || null,
        skills,
      }),
    onSuccess: () => {
      setInitialSkills(skills)
      qc.invalidateQueries({ queryKey: ['candidate', 'profile', userId] })
    },
  })

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (!trimmed || skills.includes(trimmed)) return
    setSkills([...skills, trimmed])
    setSkillInput('')
  }

  if (isLoading) return null

  return (
    <div>
      <PageHeader
        title={t('candidateProfile.title')}
        description={t('candidateProfile.description')}
        actions={
          profile && <StatusBadge status={profile.verificationStatus} />
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <Card>
          <CardBody className="space-y-5">
            <Input
              label={t('candidateProfile.email')}
              value={profile?.profile?.email ?? ''}
              disabled
              readOnly
            />
            <Input
              label={t('candidateProfile.headline')}
              placeholder={t('candidateProfile.headlinePlaceholder')}
              error={errors.headline?.message}
              {...register('headline')}
            />
            <Input
              label={t('candidateProfile.location')}
              placeholder={t('candidateProfile.locationPlaceholder')}
              error={errors.location?.message}
              {...register('location')}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('candidateProfile.bio')}
              </label>
              <textarea
                className="min-h-[120px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder={t('candidateProfile.bioPlaceholder')}
                {...register('bio')}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {t('candidateProfile.skills')}
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('candidateProfile.addSkill')}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addSkill}>
                  {t('candidateProfile.add')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills(skills.filter((s) => s !== skill))}
                  >
                    <Badge className="cursor-pointer hover:bg-slate-200">
                      {skill} ×
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="submit"
              isLoading={mutation.isPending}
              disabled={!isDirty && !skillsDirty && !mutation.isPending}
            >
              {t('candidateProfile.saveChanges')}
            </Button>
            {mutation.isSuccess && (
              <p className="text-sm text-success">{t('candidateProfile.saved')}</p>
            )}
          </CardBody>
        </Card>
      </form>
    </div>
  )
}
