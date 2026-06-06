import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileText, Inbox, Shield, Sparkles, Upload, User } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchContactRequests,
  fetchMyCandidateProfile,
  fetchMyDocuments,
} from '../actions'

const checklist = [
  { key: 'profile', label: 'Complete your profile', to: '/candidate/profile', icon: User },
  { key: 'cv', label: 'Upload your CV', to: '/candidate/upload/cv', icon: FileText },
  {
    key: 'docs',
    label: 'Add certificates & experience',
    to: '/candidate/upload/documents',
    icon: Upload,
  },
  {
    key: 'submit',
    label: 'Submit for verification',
    to: '/candidate/verification',
    icon: Shield,
  },
  {
    key: 'ai',
    label: 'Evaluate CV with AI',
    to: '/candidate/cv-evaluation',
    icon: Sparkles,
  },
] as const

export function CandidateDashboard() {
  const userId = useAuthStore((s) => s.profile!.id)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate', 'profile', userId],
    queryFn: () => fetchMyCandidateProfile(userId),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  const { data: requests = [] } = useQuery({
    queryKey: ['candidate', 'contacts', userId],
    queryFn: () => fetchContactRequests(userId),
  })

  const pendingContacts = requests.filter((r) => r.status === 'pending').length
  const hasCv = documents.some((d) => d.type === 'cv')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`${t('candidateDashboard.welcome')}, ${
          profile?.profile?.fullName?.split(' ')[0] ?? t('candidateDashboard.there')
        }`}
        description={t('candidateDashboard.description')}
      />

      <Card className="mb-8 border-primary/20 bg-gradient-to-br from-white to-primary-50/30">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">
              {t('candidateDashboard.verificationStatus')}
            </p>
            <div className="mt-2">
              {profile && <StatusBadge status={profile.verificationStatus} />}
            </div>
            {profile?.rejectionReason && (
              <p className="mt-2 text-sm text-red-600">{profile.rejectionReason}</p>
            )}
          </div>
          <Link to="/candidate/verification">
            <Button variant="secondary">
              {t('candidateDashboard.viewDetails')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardBody>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-muted">{t('candidateDashboard.documents')}</p>
            <p className="mt-1 text-2xl font-semibold">{documents.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">{t('candidateDashboard.cvUploaded')}</p>
            <p className="mt-1 text-2xl font-semibold">
              {hasCv ? t('candidateDashboard.yes') : t('candidateDashboard.no')}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">
                {t('candidateDashboard.contactRequests')}
              </p>
              <p className="mt-1 text-2xl font-semibold">{pendingContacts}</p>
            </div>
            <Link to="/candidate/contact-requests">
              <Button variant="ghost" size="sm">
                <Inbox className="h-4 w-4" />
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-4 text-lg font-semibold">
        {t('candidateDashboard.gettingStarted')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {checklist.map((item) => (
          <Link key={item.key} to={item.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{t(item.label)}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
