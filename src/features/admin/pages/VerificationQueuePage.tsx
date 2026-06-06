import { useContext, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { ClipboardList } from 'lucide-react'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchVerificationQueue, reviewCandidateSubmission } from '../actions'
import type { VerificationQueueItem } from '@/types/domain'

export function VerificationQueuePage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null)
  const [notes, setNotes] = useState('')
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: queue = [], refetch } = useQuery({
    queryKey: ['admin', 'verification-queue'],
    queryFn: () => fetchVerificationQueue(),
  })

  const review = useMutation({
    mutationFn: async ({
      userId,
      approved,
    }: {
      userId: string
      approved: boolean
    }) => {
      reviewCandidateSubmission(userId, approved, notes || undefined)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      setSelected(null)
      setNotes('')
      refetch()
    },
  })

  return (
    <div>
      <PageHeader
        title={t('verificationQueue.title')}
        description={t('verificationQueue.description')}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
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
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      {t('verificationQueue.documents')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('verificationQueue.status')}
                    </th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">
                      {t('verificationQueue.updated')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.map((item) => (
                    <tr
                      key={item.userId}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelected(item)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.fullName}</p>
                        <p className="text-xs text-muted">{item.email}</p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">{item.documentCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.verificationStatus} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted md:table-cell">
                        {formatDate(item.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card>
          <CardBody>
            {selected ? (
              <div className="space-y-4">
                <h3 className="font-semibold">{selected.fullName}</h3>
                <p className="text-sm text-muted">{selected.headline}</p>
                <p className="text-sm">
                  {selected.documentCount} {t('verificationQueue.documentCount')}
                </p>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder={t('verificationQueue.notesPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    isLoading={review.isPending}
                    onClick={() =>
                      review.mutate({ userId: selected.userId, approved: true })
                    }
                  >
                    {t('verificationQueue.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    isLoading={review.isPending}
                    onClick={() =>
                      review.mutate({ userId: selected.userId, approved: false })
                    }
                  >
                    {t('verificationQueue.reject')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {t('verificationQueue.selectCandidate')}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
