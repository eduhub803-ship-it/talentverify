import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { formatDate } from '@/lib/utils'
import { translateStatus } from '@/i18n/status'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { fetchContactRequests, respondToContactRequest } from '../actions'

export function ContactRequestsPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const lang = language?.lang ?? 'en'

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['candidate', 'contacts', userId],
    queryFn: () => fetchContactRequests(userId),
  })

  const respond = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: 'accepted' | 'declined'
    }) => respondToContactRequest(userId, id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', 'contacts', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  if (isLoading) return null

  return (
    <div>
      <PageHeader
        title={t('contactRequests.title')}
        description={t('contactRequests.description')}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('contactRequests.emptyTitle')}
          description={t('contactRequests.emptyDescription')}
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {req.organizationName ?? t('contactRequests.hrOrganization')}
                    </p>
                    <p className="text-sm text-muted">
                      {t('contactRequests.from')}{' '}
                      {req.hrName ?? t('contactRequests.hrRepresentative')} ·{' '}
                      {formatDate(req.createdAt, lang)}
                    </p>
                    <p className="mt-3 text-sm text-foreground">{req.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge
                      variant={
                        req.status === 'accepted'
                          ? 'success'
                          : req.status === 'declined'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {translateStatus(req.status, t)}
                    </Badge>
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => respond.mutate({ id: req.id, status: 'accepted' })}
                          isLoading={respond.isPending}
                        >
                          {t('contactRequests.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => respond.mutate({ id: req.id, status: 'declined' })}
                        >
                          {t('contactRequests.decline')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
