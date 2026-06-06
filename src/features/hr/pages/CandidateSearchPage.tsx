import { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Search, User } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { Badge } from '@/features/shared/components/ui/Badge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { useDebounce } from '@/features/shared/hooks/useDebounce'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchHrMembership, searchVerifiedCandidates } from '../actions'

export function CandidateSearchPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
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
        </CardBody>
      </Card>

      {results.length === 0 ? (
        <EmptyState
          icon={User}
          title={t('candidateSearch.emptyTitle')}
          description={t('candidateSearch.emptyDescription')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((c) => (
            <Link key={c.userId} to={`/hr/candidate/${c.userId}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary font-semibold">
                      {(c.profile?.fullName ?? '?')[0]}
                    </div>
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
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
