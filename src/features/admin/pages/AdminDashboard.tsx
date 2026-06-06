import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, ClipboardList, Users } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchAdminStats } from '../actions'

export function AdminDashboard() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => fetchAdminStats(),
  })

  const cards: {
    label: string
    value: number
    icon: typeof ClipboardList
    to?: string
  }[] = [
    {
      label: 'Pending verifications',
      value: stats?.pendingVerifications ?? 0,
      icon: ClipboardList,
      to: '/admin/verification-queue',
    },
    {
      label: 'Pending HR orgs',
      value: stats?.pendingHrOrgs ?? 0,
      icon: Building2,
      to: '/admin/hr-approvals',
    },
    {
      label: 'Verified candidates',
      value: stats?.verifiedCandidates ?? 0,
      icon: Users,
    },
    {
      label: 'Total candidates',
      value: stats?.totalCandidates ?? 0,
      icon: Users,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('adminDashboard.title')}
        description={t('adminDashboard.description')}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardBody>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{t(card.label)}</p>
                <card.icon className="h-5 w-5 text-muted" />
              </div>
              <p className="mt-2 text-3xl font-semibold">{card.value}</p>
              {card.to && (
                <Link to={card.to} className="mt-4 inline-block">
                  <Button variant="ghost" size="sm">
                    {t('adminDashboard.manage')}
                  </Button>
                </Link>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
