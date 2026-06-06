import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, Search } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchHrMembership } from '../actions'

export function HRDashboard() {
  const userId = useAuthStore((s) => s.profile!.id)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: membership } = useQuery({
    queryKey: ['hr', 'membership', userId],
    queryFn: () => fetchHrMembership(userId),
  })

  const org = membership?.organization
  const isApproved = org?.status === 'approved'

  return (
    <div>
      <PageHeader
        title={t('hrDashboard.title')}
        description={
          org
            ? `${org.name} — ${org.industry ?? t('hrDashboard.organizationFallback')}`
            : t('hrDashboard.descriptionFallback')
        }
      />

      {!isApproved && (
        <Card className="mb-8 border-warning/30 bg-amber-50/50">
          <CardBody className="flex gap-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-foreground">
                {t('hrDashboard.awaitingApproval')}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('hrDashboard.awaitingApprovalDescription')}
              </p>
              {org && (
                <Badge variant="warning" className="mt-3">
                  {t('hrDashboard.statusLabel')}: {org.status}
                </Badge>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{t('hrDashboard.searchTitle')}</h3>
            <p className="mt-2 text-sm text-muted">
              {t('hrDashboard.searchDescription')}
            </p>
            {isApproved ? (
              <Link to="/hr/search" className="mt-4 inline-block">
                <Button>
                  {t('hrDashboard.openSearch')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button className="mt-4" disabled>
                {t('hrDashboard.searchUnavailable')}
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="font-semibold">{t('hrDashboard.organization')}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t('hrDashboard.name')}</dt>
                <dd className="font-medium">{org?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t('hrDashboard.website')}</dt>
                <dd className="font-medium">{org?.website ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t('hrDashboard.statusLabel')}</dt>
                <dd>
                  <Badge variant={isApproved ? 'success' : 'warning'}>
                    {org?.status ?? 'unknown'}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
