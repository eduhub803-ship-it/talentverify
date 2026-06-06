import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { formatDate } from '@/lib/utils'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchPendingHrOrganizations, reviewHrOrganization } from '../actions'

export function HRApprovalsPage() {
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: orgs = [], refetch } = useQuery({
    queryKey: ['admin', 'hr-pending'],
    queryFn: () => fetchPendingHrOrganizations(),
  })

  const review = useMutation({
    mutationFn: async ({ orgId, approved }: { orgId: string; approved: boolean }) => {
      reviewHrOrganization(orgId, approved)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      refetch()
    },
  })

  return (
    <div>
      <PageHeader
        title={t('hrApprovals.title')}
        description={t('hrApprovals.description')}
      />

      {orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('hrApprovals.emptyTitle')}
          description={t('hrApprovals.emptyDescription')}
        />
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{org.name}</p>
                  <p className="text-sm text-muted">
                    {org.industry ?? t('hrApprovals.noIndustry')} ·{' '}
                    {t('hrApprovals.registered')} {formatDate(org.createdAt)}
                  </p>
                  {org.website && (
                    <a
                      href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {org.website}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    isLoading={review.isPending}
                    onClick={() => review.mutate({ orgId: org.id, approved: true })}
                  >
                    {t('hrApprovals.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => review.mutate({ orgId: org.id, approved: false })}
                  >
                    {t('hrApprovals.reject')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
