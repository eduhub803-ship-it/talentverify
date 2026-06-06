import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { VerificationTimeline } from '@/features/verification/components/VerificationTimeline'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchMyCandidateProfile,
  fetchMyDocuments,
  submitCandidateForVerification,
} from '../actions'

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

  const submit = useMutation({
    mutationFn: () => submitCandidateForVerification(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', 'profile', userId] })
    },
  })

  const hasCv = documents.some((d) => d.type === 'cv')
  const canSubmit =
    profile?.verificationStatus === 'draft' ||
    profile?.verificationStatus === 'rejected'

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
            <ul className="space-y-2 text-sm text-muted">
              <li className={profile?.headline ? 'text-success' : ''}>
                {profile?.headline ? '✓' : '○'} {t('verificationStatus.profileHeadlineSet')}
              </li>
              <li className={hasCv ? 'text-success' : ''}>
                {hasCv ? '✓' : '○'} {t('verificationStatus.cvUploaded')}
              </li>
              <li>
                {documents.length} {t('verificationStatus.documentsOnFile')}
              </li>
            </ul>
            {profile?.rejectionReason && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">{t('verificationStatus.rejectionReason')}</p>
                <p className="mt-1">{profile.rejectionReason}</p>
              </div>
            )}
            {canSubmit && (
              <Button
                className="w-full"
                disabled={!hasCv || submit.isPending}
                isLoading={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {t('verificationStatus.submitForVerification')}
              </Button>
            )}
            {profile?.verificationStatus === 'pending' && (
              <p className="text-sm text-muted">
                {t('verificationStatus.pendingMessage')}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
