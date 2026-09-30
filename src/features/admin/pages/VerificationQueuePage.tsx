import { useContext, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Avatar } from '@/features/shared/components/ui/Avatar'
import { Badge } from '@/features/shared/components/ui/Badge'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { AlertTriangle, Check, ClipboardList, ExternalLink } from 'lucide-react'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchVerificationQueue, reviewCandidateSubmission } from '../actions'
import { adminQueryKeys, invalidateAdminWorkspace } from '../queryKeys'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { VerificationQueueItem } from '@/types/domain'

/** Only the LinkedIn profile is stored for a candidate under review. */
function getLinks(item: VerificationQueueItem) {
  return item.linkedinUrl
    ? [{ label: 'LinkedIn', url: item.linkedinUrl }]
    : []
}

export function VerificationQueuePage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null)
  const [notes, setNotes] = useState('')
  const [reviewed, setReviewed] = useState<string | null>(null)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const lang = language?.lang ?? 'en'

  const { data: queue = [], refetch } = useQuery({
    queryKey: adminQueryKeys.verificationQueue,
    queryFn: fetchVerificationQueue,
  })

  const review = useMutation({
    mutationFn: async ({
      userId,
      approved,
    }: {
      userId: string
      approved: boolean
    }) => {
      return reviewCandidateSubmission(userId, approved, notes || undefined)
    },
    onSuccess: (_result, variables) => {
      void invalidateAdminWorkspace(qc)
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setReviewed(variables.approved ? 'approved' : 'rejected')
      setSelected(null)
      setNotes('')
      refetch()
    },
  })

  const links = selected ? getLinks(selected) : []

  return (
    <div>
      <PageHeader
        title={t('verificationQueue.title')}
        description={t('verificationQueue.description')}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">
                  {t('verificationQueue.requestsTitle')}
                </h2>
                <p className="text-sm text-muted">
                  {t('adminVerification.listHint')}
                </p>
              </div>
              <Badge variant="warning">{queue.length}</Badge>
            </div>

            {queue.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={t('verificationQueue.emptyTitle')}
                description={t('verificationQueue.emptyDescription')}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        {t('verificationQueue.candidate')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('verificationQueue.documentStatus')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('verificationQueue.status')}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t('verificationQueue.updated')}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {queue.map((item) => (
                      <tr
                        key={item.userId}
                        className={
                          selected?.userId === item.userId
                            ? 'cursor-pointer bg-primary-50/70'
                            : 'cursor-pointer hover:bg-slate-50'
                        }
                        onClick={() => {
                          setReviewed(null)
                          setSelected(item)
                        }}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">
                            {item.fullName}
                          </p>
                          <p className="text-xs text-muted">{item.email}</p>
                          {item.headline && (
                            <p className="mt-1 text-xs text-muted">
                              {item.headline}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {item.documentCount} {t('verificationQueue.documentCount')}
                          </p>
                          <p className="text-xs text-muted">
                            {item.documentCount > 0
                              ? t('verificationQueue.readyForReview')
                              : t('verificationQueue.needsDocuments')}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={item.verificationStatus} />
                        </td>

                        <td className="px-4 py-3 text-muted">
                          {formatDate(item.updatedAt, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-foreground">
              {selected
                ? t('adminVerification.candidateProfile')
                : t('adminVerification.reviewDecision')}
            </h2>

            {!selected ? (
              <div className="space-y-3">
                {reviewed && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                    <Check className="h-4 w-4" />
                    {reviewed === 'approved'
                      ? t('adminVerification.approvedMessage')
                      : t('adminVerification.rejectedMessage')}
                  </p>
                )}
                <p className="text-sm text-muted">
                  {t('adminVerification.selectCandidateHint')}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-slate-50 p-4 text-center">
                  <div className="mb-3 flex justify-center">
                    <Avatar
                      src={selected.avatarUrl}
                      name={selected.fullName}
                      email={selected.email}
                      size="lg"
                    />
                  </div>
                  <p className="text-xs font-medium text-muted">
                    {t('adminVerification.reviewingCandidate')}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    {selected.fullName}
                  </h3>
                  <p className="text-sm text-muted">{selected.email}</p>
                  {selected.headline && (
                    <p className="mt-2 text-sm text-muted">
                      {selected.headline}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 font-semibold text-foreground">
                    {t('adminVerification.basicInfo')}
                  </h3>

                  <div className="space-y-3 text-sm">
                    <InfoRow
                      label={t('common.status')}
                      value={<StatusBadge status={selected.verificationStatus} />}
                    />
                    <InfoRow
                      label={t('adminVerification.documents')}
                      value={`${selected.documentCount} ${t('verificationQueue.documentCount')}`}
                    />
                    <InfoRow
                      label={t('adminVerification.updated')}
                      value={formatDate(selected.updatedAt, lang)}
                    />
                    <InfoRow
                      label={t('adminVerification.location')}
                      value={selected.location || t('common.notAvailable')}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 font-semibold text-foreground">
                    {t('adminVerification.professionalSummary')}
                  </h3>
                  <p className="text-sm leading-6 text-muted">
                    {selected.bio ||
                      selected.headline ||
                      t('adminVerification.noSummary')}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 font-semibold text-foreground">
                    {t('adminVerification.filesLinks')}
                  </h3>

                  {links.length > 0 ? (
                    <div className="space-y-2">
                      {links.map((link) => (
                        <a
                          key={link.label}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      {t('adminVerification.noLinks')}
                    </p>
                  )}
                </div>

                <textarea
                  className="min-h-[90px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder={t('adminVerification.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                {review.isError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {review.error instanceof Error
                        ? review.error.message
                        : t('adminVerification.saveFailed')}
                    </span>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {t('verificationQueue.actionArea')}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="flex-1"
                      isLoading={review.isPending}
                      onClick={() =>
                        review.mutate({
                          userId: selected.userId,
                          approved: false,
                        })
                      }
                    >
                      {t('verificationQueue.reject')}
                    </Button>

                    <Button
                      className="flex-1"
                      isLoading={review.isPending}
                      onClick={() =>
                        review.mutate({
                          userId: selected.userId,
                          approved: true,
                        })
                      }
                    >
                      {t('verificationQueue.approve')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}
