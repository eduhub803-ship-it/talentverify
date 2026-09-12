import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Briefcase,
  Eye,
  EyeOff,
  FileText,
  Inbox,
  Shield,
  Sparkles,
  Upload,
  User,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { StatusBadge } from '@/features/shared/components/ui/StatusBadge'
import { Avatar } from '@/features/shared/components/ui/Avatar'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchContactRequests,
  fetchMyCandidateProfile,
  fetchMyDocuments,
} from '../actions'
import { fetchCandidateJobApplicationContext } from '@/features/applications/actions'
import { calculatePassportCompletion } from '../passport'

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

  const { data: applicationContext } = useQuery({
    queryKey: ['applications', 'candidate-context', userId],
    queryFn: () => fetchCandidateJobApplicationContext(userId),
  })

  const pendingContacts = requests.filter((r) => r.status === 'pending').length
  const hasCv = documents.some((d) => d.type === 'cv')
  const completion = calculatePassportCompletion(profile, documents)
  const applications = applicationContext?.applications ?? []
  const pendingApplications = applications.filter((item) => item.status === 'pending').length
  const isEmployerVisible = Boolean(profile?.employerVisible)
  const isDiscoverable = isEmployerVisible && profile?.verificationStatus === 'verified'

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
          <div className="flex items-start gap-4">
            <Avatar
              src={profile?.profile?.avatarUrl}
              name={profile?.profile?.fullName}
              email={profile?.profile?.email}
              size="lg"
              className="hidden sm:inline-flex"
            />
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
            <p className="mt-3 text-sm text-muted">
              Talent Passport {completion.percent}% complete. Next: {completion.nextAction}.
            </p>

            {completion.missingRequired.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground">
                  {t('candidateDashboard.missingItems')}
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {completion.missingRequired.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </div>

          <Link to="/candidate/verification">
            <Button variant="secondary">
              {t('candidateDashboard.viewDetails')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-muted">
              {isDiscoverable ? (
                <Eye className="h-5 w-5" />
              ) : (
                <EyeOff className="h-5 w-5" />
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">
                  {t('candidateDashboard.employerVisibility')}
                </p>
                <Badge variant={isDiscoverable ? 'success' : 'warning'}>
                  {isDiscoverable
                    ? t('candidateDashboard.discoverable')
                    : t('candidateDashboard.notDiscoverable')}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {isDiscoverable
                  ? t('candidateDashboard.discoverableHint')
                  : !isEmployerVisible
                    ? t('candidateDashboard.visibilityOffHint')
                    : t('candidateDashboard.notVerifiedHint')}
              </p>
            </div>
          </div>
          <Link to="/candidate/profile">
            <Button variant="secondary" size="sm">
              {t('candidateDashboard.manageVisibility')}
            </Button>
          </Link>
        </CardBody>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Talent Passport</p>
            <p className="mt-1 text-2xl font-semibold">{completion.percent}%</p>
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
              <Button variant="ghost" size="sm" aria-label={t('candidateDashboard.contactRequests')}>
                <Inbox className="h-4 w-4" />
              </Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">{t('candidateDashboard.applications')}</p>
              <p className="mt-1 text-2xl font-semibold">{applications.length}</p>
              {applications.length > 0 && (
                <p className="text-xs text-muted">
                  {pendingApplications} {t('candidateDashboard.underReview')}
                </p>
              )}
            </div>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" aria-label={t('candidateDashboard.applications')}>
                <Briefcase className="h-4 w-4" />
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
