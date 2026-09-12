import { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Upload, Users } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { LanguageContext } from '@/context/LanguageContext'
import { formatDate } from '@/lib/utils'
import { fetchImportBatches, fetchImportedCandidates } from '../actions'
import { adminQueryKeys } from '../queryKeys'

export function ImportedCandidatesPage() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [search, setSearch] = useState('')
  const [batchId, setBatchId] = useState<string>('')

  const { data: candidates = [] } = useQuery({
    queryKey: adminQueryKeys.importedCandidates,
    queryFn: () => fetchImportedCandidates(),
  })

  const { data: batches = [] } = useQuery({
    queryKey: adminQueryKeys.importBatches,
    queryFn: fetchImportBatches,
  })

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return candidates.filter((candidate) => {
      if (batchId && candidate.batchId !== batchId) return false
      if (!query) return true
      return (
        candidate.fullName.toLowerCase().includes(query) ||
        candidate.email.toLowerCase().includes(query) ||
        (candidate.location ?? '').toLowerCase().includes(query)
      )
    })
  }, [candidates, search, batchId])

  return (
    <div>
      <PageHeader
        title={t('adminImported.title')}
        description={t('adminImported.description')}
        actions={
          <Link to="/admin/import-candidates">
            <Button>
              <Upload className="h-4 w-4" />
              {t('adminImported.goToImport')}
            </Button>
          </Link>
        }
      />

      {candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('adminImported.emptyTitle')}
          description={t('adminImported.emptyDescription')}
          action={
            <Link to="/admin/import-candidates">
              <Button>
                <Upload className="h-4 w-4" />
                {t('adminImported.goToImport')}
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    name="imported-search"
                    placeholder={t('adminImported.search')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <select
                  className="h-10 rounded-lg border border-border bg-white px-3 text-sm"
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                >
                  <option value="">{t('adminImported.allBatches')}</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.fileName} — {formatDate(batch.createdAt)}
                    </option>
                  ))}
                </select>
                <Badge variant="primary">{filtered.length}</Badge>
              </div>

              {filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                  {t('adminImported.noMatches')}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('adminImported.name')}</th>
                        <th className="px-4 py-3 font-medium">{t('adminImported.phone')}</th>
                        <th className="px-4 py-3 font-medium">{t('adminImported.skills')}</th>
                        <th className="px-4 py-3 font-medium">
                          {t('adminImported.accountStatus')}
                        </th>
                        <th className="px-4 py-3 font-medium">
                          {t('adminImported.imported')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((candidate) => (
                        <tr key={candidate.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground" dir="auto">
                              {candidate.fullName}
                            </p>
                            <p className="text-xs text-muted" dir="ltr">
                              {candidate.email}
                            </p>
                            {candidate.location && (
                              <p className="text-xs text-muted">{candidate.location}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted" dir="ltr">
                            {candidate.phone ?? '—'}
                          </td>
                          <td className="max-w-[260px] px-4 py-3 text-muted">
                            {candidate.skills.length > 0 ? candidate.skills.join(', ') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={candidate.status === 'claimed' ? 'success' : 'warning'}
                            >
                              {candidate.status === 'claimed'
                                ? t('adminImported.statusClaimed')
                                : t('adminImported.statusImported')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {formatDate(candidate.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-foreground">{t('adminImported.batches')}</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => setBatchId(batchId === batch.id ? '' : batch.id)}
                  className={
                    batchId === batch.id
                      ? 'w-full rounded-lg border border-primary bg-primary-50/60 px-3 py-2 text-left'
                      : 'w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-slate-50'
                  }
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {batch.fileName}
                  </p>
                  <p className="text-xs text-muted">{formatDate(batch.createdAt)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t('adminImported.batchCreated')}: {batch.createdCount} ·{' '}
                    {t('adminImported.batchSkipped')}: {batch.skippedDuplicateCount} ·{' '}
                    {t('adminImported.batchErrors')}: {batch.errorCount}
                  </p>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
