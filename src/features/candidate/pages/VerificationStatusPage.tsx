import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { VerificationTimeline } from '@/features/verification/components/VerificationTimeline'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import {
  fetchMyCandidateProfile,
  fetchMyDocuments,
  submitCandidateForVerification,
} from '../actions'
import { calculatePassportCompletion } from '../passport'

export function VerificationStatusPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: profile } = useQuery({
    queryKey: ['candidate', 'profile', userId],
    queryFn: () => fetchMyCandidateProfile(userId),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  const completion = calculatePassportCompletion(profile, documents)
  const canAttemptSubmit =
    profile?.verificationStatus === 'draft' || profile?.verificationStatus === 'rejected'
  const canSubmit = canAttemptSubmit && completion.canSubmitForVerification

  const submit = useMutation({
    mutationFn: () => submitCandidateForVerification(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', 'profile', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  return (
    <div>
      <PageHeader
        title={t('verificationStatus.title')}
        description={t('verificationStatus.description')}
        actions={profile && <StatusBadge status={profile.verificationStatus} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-6 font-semibold">{t('verificationStatus.progress')}</h2>
            {profile && <VerificationTimeline status={profile.verificationStatus} />}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold">{t('verificationStatus.submitForReview')}</h2>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-primary" style={{ width: `${completion.percent}%` }} />
            </div>
            <p className="text-sm text-muted">
              Talent Passport {completion.percent}% complete.
            </p>

            <ul className="space-y-2 text-sm text-muted">
              {completion.sections.map((section) => (
                <li key={section.key} className={section.complete ? 'text-success' : ''}>
                  {section.complete ? '✓' : '○'} {section.label}
                </li>
              ))}
              <li>{documents.length} {t('verificationStatus.documentsOnFile')}</li>
            </ul>

            {!completion.canSubmitForVerification && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-warning">
                Complete these items before submitting: {completion.missingRequired.join(', ')}.
              </div>
            )}

            {profile?.rejectionReason && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">{t('verificationStatus.rejectionReason')}</p>
                <p className="mt-1">{profile.rejectionReason}</p>
              </div>
            )}

            {canAttemptSubmit && (
              <Button
                className="w-full"
                disabled={!canSubmit || submit.isPending}
                isLoading={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {t('verificationStatus.submitForVerification')}
              </Button>
            )}

            {!canSubmit && canAttemptSubmit && (
              <Link to="/candidate/profile">
                <Button type="button" variant="secondary" className="w-full">
                  Complete Talent Passport
                </Button>
              </Link>
            )}

            {submit.isError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {submit.error instanceof Error
                  ? submit.error.message
                  : 'Verification request could not be submitted.'}
              </p>
            )}

            {profile?.verificationStatus === 'pending' && (
              <p className="text-sm text-muted">{t('verificationStatus.pendingMessage')}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
