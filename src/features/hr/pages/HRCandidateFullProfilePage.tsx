import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  GraduationCap,
  Mail,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { useAuthStore } from '@/stores/auth-store'
import {
  fetchCandidateFullProfile,
  fetchHrMembership,
  getCvDownloadUrl,
  sendHrContactRequest,
} from '../actions'

export function HRCandidateFullProfilePage() {
  const { id } = useParams<{ id: string }>()
  const hrUserId = useAuthStore((s) => s.profile!.id)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const { data: membership } = useQuery({
    queryKey: ['hr', 'membership', hrUserId],
    queryFn: () => fetchHrMembership(hrUserId),
  })

  const {
    data: candidate,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['hr', 'candidate-full', id, hrUserId],
    queryFn: () => fetchCandidateFullProfile(hrUserId, id!),
    enabled: Boolean(id),
  })

  const contact = useMutation({
    mutationFn: () =>
      sendHrContactRequest({
        hrUserId,
        candidateId: id!,
        organizationId: membership!.organizationId,
        message,
      }),
    onSuccess: () => {
      setSent(true)
      setContactError(null)
    },
    onError: (e) =>
      setContactError(e instanceof Error ? e.message : 'Failed to send request'),
  })

  const cvUrl = candidate ? getCvDownloadUrl(candidate) : null

  const handleDownload = () => {
    if (!cvUrl) return
    const a = document.createElement('a')
    a.href = cvUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = `${candidate?.name ?? 'candidate'}-cv.pdf`
    a.click()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div>
        <Link to="/hr/search" className="text-sm text-primary hover:underline">
          ← Back to search
        </Link>
        <EmptyState
          icon={BadgeCheck}
          title="Profile unavailable"
          description={
            error instanceof Error
              ? error.message
              : 'Candidate not found or not verified.'
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/hr/search"
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>

      <PageHeader
        title={candidate.name}
        description={candidate.location ?? undefined}
        actions={
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-success">
            <BadgeCheck className="h-4 w-4" />
            Verified
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardBody className="space-y-4 p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">CV Preview</h2>
              <Button
                variant="secondary"
                size="sm"
                disabled={!cvUrl}
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download CV
              </Button>
            </div>
            {cvUrl ? (
              <iframe
                title={`CV — ${candidate.name}`}
                src={cvUrl}
                className="h-[min(70vh,560px)] w-full border-0 bg-slate-100"
              />
            ) : (
              <div className="px-5 py-16 text-center text-sm text-muted">
                No CV on file for this candidate.
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <h2 className="font-semibold">Candidate information</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-muted" />
                  <div>
                    <dt className="text-muted">Email</dt>
                    <dd className="font-medium">{candidate.email}</dd>
                  </div>
                </div>
                {candidate.location && (
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted" />
                    <div>
                      <dt className="text-muted">Location</dt>
                      <dd className="font-medium">{candidate.location}</dd>
                    </div>
                  </div>
                )}
                {candidate.experienceYears != null && (
                  <div>
                    <dt className="text-muted">Experience</dt>
                    <dd className="font-medium">{candidate.experienceYears} years</dd>
                  </div>
                )}
                {candidate.education && (
                  <div className="flex gap-2">
                    <GraduationCap className="mt-0.5 h-4 w-4 text-muted" />
                    <div>
                      <dt className="text-muted">Education</dt>
                      <dd className="font-medium">{candidate.education}</dd>
                    </div>
                  </div>
                )}
              </dl>

              <div>
                <h3 className="text-sm font-medium text-muted">Skills</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidate.skills.map((s) => (
                    <Badge key={s} variant="primary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {candidate.jobMatchScore != null && (
                <div className="rounded-lg bg-primary-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Job match score
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-primary">
                    {candidate.jobMatchScore}%
                  </p>
                </div>
              )}

              {candidate.aiSummary && (
                <div className="rounded-lg border border-border bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI summary
                  </p>
                  <p className="mt-2 text-sm text-muted">{candidate.aiSummary}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <h3 className="font-semibold">Send contact request</h3>
              {sent ? (
                <p className="text-sm text-success">Request sent successfully.</p>
              ) : (
                <>
                  <textarea
                    className="min-h-[100px] w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    placeholder="Introduce your organization and role..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  {contactError && (
                    <p className="text-xs text-red-600">{contactError}</p>
                  )}
                  <Button
                    className="w-full"
                    disabled={message.trim().length < 10}
                    isLoading={contact.isPending}
                    onClick={() => contact.mutate()}
                  >
                    Send request
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
