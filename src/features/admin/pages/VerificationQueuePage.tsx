import { useContext, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchVerificationQueue, reviewCandidateSubmission } from '../actions'
import { adminQueryKeys, invalidateAdminWorkspace } from '../queryKeys'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { VerificationQueueItem } from '@/types/domain'

type QueueItemExtra = VerificationQueueItem & Record<string, unknown>

function getText(item: QueueItemExtra, keys: string[]) {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function getLinks(item: QueueItemExtra) {
  const keys = [
    'resumeUrl',
    'cvUrl',
    'profileUrl',
    'portfolioUrl',
    'linkedinUrl',
    'documentUrl',
    'attachmentUrl',
  ]

  return keys
    .map((key) => ({ label: key, url: item[key] }))
    .filter(
      (link): link is { label: string; url: string } =>
        typeof link.url === 'string' && link.url.trim().length > 0,
    )
}

export function VerificationQueuePage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<VerificationQueueItem | null>(null)
  const [notes, setNotes] = useState('')
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

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
    onSuccess: () => {
      void invalidateAdminWorkspace(qc)
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setSelected(null)
      setNotes('')
      refetch()
    },
  })

  const selectedExtra = selected as QueueItemExtra | null
  const links = selectedExtra ? getLinks(selectedExtra) : []

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
                  اضغط على المرشح لعرض ملفه الكامل واتخاذ قرار المراجعة.
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
                        onClick={() => setSelected(item)}
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
                            {item.documentCount} مستند
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
                          {formatDate(item.updatedAt)}
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
              {selected ? 'ملف المرشح' : 'قرار المراجعة'}
            </h2>

            {!selected || !selectedExtra ? (
              <p className="text-sm text-muted">
                اختر مرشحًا من القائمة لعرض تفاصيله.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium text-muted">
                    المرشح قيد المراجعة
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
                    معلومات أساسية
                  </h3>

                  <div className="space-y-3 text-sm">
                    <InfoRow
                      label="الحالة"
                      value={<StatusBadge status={selected.verificationStatus} />}
                    />
                    <InfoRow
                      label="المستندات"
                      value={`${selected.documentCount} مستند`}
                    />
                    <InfoRow
                      label="آخر تحديث"
                      value={formatDate(selected.updatedAt)}
                    />
                    <InfoRow
                      label="الهاتف"
                      value={
                        getText(selectedExtra, [
                          'phone',
                          'phoneNumber',
                          'mobile',
                        ]) || 'غير متوفر'
                      }
                    />
                    <InfoRow
                      label="الموقع"
                      value={
                        getText(selectedExtra, [
                          'location',
                          'city',
                          'country',
                        ]) || 'غير متوفر'
                      }
                    />
                    <InfoRow
                      label="سنوات الخبرة"
                      value={
                        getText(selectedExtra, [
                          'experienceYears',
                          'yearsOfExperience',
                          'experience',
                        ]) || 'غير متوفر'
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 font-semibold text-foreground">
                    النبذة المهنية
                  </h3>
                  <p className="text-sm leading-6 text-muted">
                    {getText(selectedExtra, [
                      'bio',
                      'summary',
                      'about',
                      'description',
                    ]) ||
                      selected.headline ||
                      'لا توجد نبذة مهنية مضافة لهذا المرشح.'}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h3 className="mb-3 font-semibold text-foreground">
                    الملفات والروابط
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
                      لا توجد ملفات أو روابط ظاهرة من بيانات هذا المرشح.
                    </p>
                  )}
                </div>

                <textarea
                  className="min-h-[90px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder="ملاحظات المراجعة، مطلوبة عند الرفض"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    إجراء الموافقة / الرفض
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
                      رفض
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
                      موافقة
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
