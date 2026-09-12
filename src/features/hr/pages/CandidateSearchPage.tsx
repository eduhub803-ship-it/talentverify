import { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, MapPin, Search, Star, User } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { Avatar } from '@/features/shared/components/ui/Avatar'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { useDebounce } from '@/features/shared/hooks/useDebounce'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchHrMembership,
  fetchShortlistedCandidateIds,
  searchVerifiedCandidates,
  toggleCandidateShortlist,
} from '../actions'
import { applyResultCap, limitsFor, planOf } from '@/features/employer/plans'

export function CandidateSearchPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
  const [shortlistedOnly, setShortlistedOnly] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const debouncedLocation = useDebounce(location, 300)

  const { data: membership } = useQuery({
    queryKey: ['hr', 'membership', userId],
    queryFn: () => fetchHrMembership(userId),
  })

  const skills = useMemo(
    () =>
      skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [skillsInput],
  )

  const { data: results = [] } = useQuery({
    queryKey: ['hr', 'search', debouncedQuery, debouncedLocation, skills],
    queryFn: () =>
      searchVerifiedCandidates(userId, {
        query: debouncedQuery || undefined,
        location: debouncedLocation || undefined,
        skills: skills.length ? skills : undefined,
      }),
    enabled: membership?.organization?.status === 'approved',
  })

  const { data: shortlistedIds = [] } = useQuery({
    queryKey: ['hr', 'shortlists', userId],
    queryFn: () => fetchShortlistedCandidateIds(userId),
    enabled: membership?.organization?.status === 'approved',
  })

  const shortlist = useMutation({
    mutationFn: (candidateId: string) =>
      toggleCandidateShortlist({ hrUserId: userId, candidateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr', 'shortlists', userId] })
    },
  })

  const shortlisted = new Set(shortlistedIds)
  // Shortlisting was previously write-only: this filter makes the saved list readable.
  const matching = shortlistedOnly
    ? results.filter((candidate) => shortlisted.has(candidate.userId))
    : results

  // Service 32: the Free plan sees a capped result set.
  const plan = planOf(membership?.organization)
  const resultLimit = limitsFor(membership?.organization).searchResults
  const visibleResults = applyResultCap(matching, resultLimit)
  const cappedCount = matching.length - visibleResults.length

  if (membership?.organization?.status !== 'approved') {
    return (
      <div>
        <PageHeader title={t('candidateSearch.shortTitle')} />
        <EmptyState
          icon={Search}
          title={t('candidateSearch.notAvailableTitle')}
          description={t('candidateSearch.notAvailableDescription')}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('candidateSearch.title')}
        description={t('candidateSearch.description')}
      />

      <Card className="mb-6">
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Input
            label={t('candidateSearch.searchLabel')}
            placeholder={t('candidateSearch.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Input
            label={t('candidateSearch.locationLabel')}
            placeholder={t('candidateSearch.locationPlaceholder')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label={t('candidateSearch.skillsLabel')}
            placeholder={t('candidateSearch.skillsPlaceholder')}
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <Button
              type="button"
              size="sm"
              variant={shortlistedOnly ? 'primary' : 'secondary'}
              aria-pressed={shortlistedOnly}
              onClick={() => setShortlistedOnly((value) => !value)}
            >
              <Star className="h-4 w-4" />
              {t('candidateSearch.shortlistedOnly')} ({shortlistedIds.length})
            </Button>
            {(query || location || skillsInput || shortlistedOnly) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery('')
                  setLocation('')
                  setSkillsInput('')
                  setShortlistedOnly(false)
                }}
              >
                {t('candidateSearch.clearFilters')}
              </Button>
            )}
            <span className="text-sm text-muted">
              {visibleResults.length} {t('candidateSearch.resultsCount')}
            </span>
            <Badge variant={plan === 'pro' ? 'primary' : 'default'}>
              {plan === 'pro' ? t('employer.plan.pro') : t('employer.plan.free')}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {cappedCount > 0 && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary-50/40 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {t('employer.search.cappedTitle').replace('{count}', String(cappedCount))}
          </p>
          <p className="mt-1 text-muted">{t('employer.search.cappedDescription')}</p>
          <Link to="/hr/organization" className="mt-2 inline-block">
            <Button type="button" size="sm" variant="secondary">
              {t('employer.plan.viewPlan')}
            </Button>
          </Link>
        </div>
      )}

      {visibleResults.length === 0 ? (
        <EmptyState
          icon={shortlistedOnly ? Star : User}
          title={
            shortlistedOnly
              ? t('candidateSearch.emptyShortlistTitle')
              : t('candidateSearch.emptyTitle')
          }
          description={
            shortlistedOnly
              ? t('candidateSearch.emptyShortlistDescription')
              : t('candidateSearch.emptyDescription')
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleResults.map((c) => (
            <Card key={c.userId} className="h-full">
              <CardBody className="flex h-full flex-col">
                <div className="flex items-start gap-4">
                  <Avatar
                    src={c.profile?.avatarUrl}
                    name={c.profile?.fullName}
                    email={c.profile?.email}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {c.profile?.fullName ?? t('candidateSearch.verifiedCandidate')}
                    </p>
                    <p className="text-sm text-muted">{c.headline}</p>
                    {c.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <MapPin className="h-3 w-3" />
                        {c.location}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.skills.slice(0, 4).map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Link to={`/hr/candidate/${c.userId}`}>
                    <Button size="sm" variant="secondary">
                      {t('candidateSearch.review')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant={shortlisted.has(c.userId) ? 'primary' : 'secondary'}
                    isLoading={shortlist.isPending && shortlist.variables === c.userId}
                    disabled={shortlist.isPending}
                    onClick={() => shortlist.mutate(c.userId)}
                  >
                    <Star className="h-4 w-4" />
                    {shortlisted.has(c.userId)
                      ? t('candidateSearch.shortlisted')
                      : t('candidateSearch.shortlist')}
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
