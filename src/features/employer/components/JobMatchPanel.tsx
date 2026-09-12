import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Sparkles, Star, User } from 'lucide-react'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { toggleCandidateShortlist } from '@/features/hr/actions'
import { fetchJobMatches } from '../actions'
import { employerQueryKeys } from '../queryKeys'

/**
 * Service 34. Every match shows why it scored what it did - the pool is the
 * existing verified + employer-visible search, so this widens nothing.
 */
export function JobMatchPanel({ jobId }: { jobId: string }) {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data, error, isLoading } = useQuery({
    queryKey: employerQueryKeys.matches(jobId),
    queryFn: () => fetchJobMatches({ actor, jobId }),
  })

  const shortlist = useMutation({
    mutationFn: (candidateId: string) =>
      toggleCandidateShortlist({ hrUserId: actor!.id, candidateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employerQueryKeys.matches(jobId) })
      qc.invalidateQueries({ queryKey: ['hr', 'shortlists', actor!.id] })
    },
  })

  if (isLoading) return null

  if (error) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-start gap-2 text-sm text-muted">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error instanceof Error ? error.message : t('matching.unavailable')}</span>
          </div>
        </CardBody>
      </Card>
    )
  }

  const matches = data?.matches ?? []
  const hidden = data && data.limit !== null ? Math.max(0, data.total - matches.length) : 0

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{t('matching.title')}</h2>
          </div>
          <Badge variant="primary">{matches.length}</Badge>
        </div>

        <p className="text-sm text-muted">{t('matching.description')}</p>

        {matches.length === 0 ? (
          <EmptyState
            icon={User}
            title={t('matching.emptyTitle')}
            description={t('matching.emptyDescription')}
          />
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.candidateId} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{match.candidateName}</p>
                    {match.headline && (
                      <p className="text-sm text-muted">{match.headline}</p>
                    )}
                    {match.location && (
                      <p className="text-xs text-muted">{match.location}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-lg font-semibold text-foreground">{match.score}%</p>
                    <p className="text-xs text-muted">{t('matching.ruleBased')}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted">
                  {match.reasons.map((reason) => (
                    <p key={reason}>• {reason}</p>
                  ))}
                </div>

                {match.matchedRequirements.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {match.matchedRequirements.map((requirement) => (
                      <Badge key={requirement} variant="success">
                        {requirement}
                      </Badge>
                    ))}
                  </div>
                )}

                {match.missingRequirements.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {match.missingRequirements.map((requirement) => (
                      <Badge key={requirement} variant="warning">
                        {requirement}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/hr/candidate/${match.candidateId}`}>
                    <Button type="button" size="sm" variant="secondary">
                      <User className="h-4 w-4" />
                      {t('matching.viewProfile')}
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant={match.shortlisted ? 'primary' : 'secondary'}
                    isLoading={
                      shortlist.isPending && shortlist.variables === match.candidateId
                    }
                    disabled={shortlist.isPending}
                    onClick={() => shortlist.mutate(match.candidateId)}
                  >
                    <Star className="h-4 w-4" />
                    {match.shortlisted
                      ? t('matching.shortlisted')
                      : t('matching.shortlist')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hidden > 0 && (
          <p className="rounded-lg border border-primary/30 bg-primary-50/40 px-3 py-2 text-sm text-muted">
            {t('matching.planCapped').replace('{count}', String(hidden))}
          </p>
        )}

        <p className="text-xs text-muted">{t('matching.privacyNote')}</p>
      </CardBody>
    </Card>
  )
}
