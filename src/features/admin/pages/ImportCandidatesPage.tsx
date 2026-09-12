import { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  fetchCandidateDirectory,
  importCandidates as runImport,
} from '../actions'
import { adminQueryKeys, invalidateAdminWorkspace } from '../queryKeys'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import {
  IMPORT_FIELDS,
  autoDetectMapping,
  buildImportTemplateCsv,
  missingRequiredFields,
  type ColumnMapping,
  type ImportFieldKey,
} from '../import/fields'
import { parseImportFile, type ParsedSheet } from '../import/parse'
import {
  importableRows,
  validateImportRows,
  rowIssueText,
  type ImportRowStatus,
  type ValidatedRow,
  type ValidationResult,
} from '../import/validate'
import { buildErrorReportCsv, downloadCsv } from '../import/report'
import type { ImportCandidatesResult } from '../api/candidate-import.service'

type WizardStep = 'file' | 'map' | 'preview' | 'result'
type PreviewTab = 'all' | 'valid' | 'errors' | 'duplicates' | 'conflicts'

const STATUS_TOKENS: Record<
  ImportRowStatus,
  { labelKey: string; variant: 'success' | 'danger' | 'warning' | 'default' }
> = {
  valid: { labelKey: 'adminImport.statusValid', variant: 'success' },
  error: { labelKey: 'adminImport.statusError', variant: 'danger' },
  duplicate_in_file: { labelKey: 'adminImport.statusDuplicateInFile', variant: 'warning' },
  existing_candidate: { labelKey: 'adminImport.statusExisting', variant: 'warning' },
  conflict: { labelKey: 'adminImport.statusConflict', variant: 'warning' },
}

function tabFilter(tab: PreviewTab, row: ValidatedRow): boolean {
  switch (tab) {
    case 'valid':
      return row.status === 'valid'
    case 'errors':
      return row.status === 'error'
    case 'duplicates':
      return row.status === 'duplicate_in_file' || row.status === 'existing_candidate'
    case 'conflicts':
      return row.status === 'conflict'
    default:
      return true
  }
}

export function ImportCandidatesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'
  const profile = useAuthStore((state) => state.profile)

  const [step, setStep] = useState<WizardStep>('file')
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>([])
  const [tab, setTab] = useState<PreviewTab>('all')
  const [fileError, setFileError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [result, setResult] = useState<ImportCandidatesResult | null>(null)
  const [resultValidation, setResultValidation] = useState<ValidationResult | null>(null)

  const { data: directory = [] } = useQuery({
    queryKey: adminQueryKeys.candidateDirectory,
    queryFn: fetchCandidateDirectory,
  })

  const validation = useMemo<ValidationResult | null>(() => {
    if (!sheet || step === 'file') return null
    if (missingRequiredFields(mapping).length > 0) return null
    return validateImportRows({ sheet, mapping, directory })
  }, [sheet, mapping, directory, step])

  const readyRows = validation ? importableRows(validation.rows) : []

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!sheet || !validation) throw new Error('Nothing to import')
      return runImport({
        fileName: sheet.fileName,
        importedBy: profile?.id ?? '',
        rows: readyRows.map((row) => ({ rowNumber: row.rowNumber, data: row.data! })),
        skippedDuplicateCount:
          validation.summary.duplicatesInFile + validation.summary.existingCandidates,
        conflictCount: validation.summary.conflicts,
        errorCount: validation.summary.errors,
        totalRows: validation.summary.total,
      })
    },
    onSuccess: (data) => {
      setResult(data)
      setResultValidation(validation)
      setStep('result')
      void invalidateAdminWorkspace(qc)
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  const handleFile = async (file: File) => {
    setFileError(null)
    setIsParsing(true)
    try {
      const parsed = await parseImportFile(file)
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        throw new Error('The file has no data rows below the header.')
      }
      setSheet(parsed)
      setMapping(autoDetectMapping(parsed.headers))
      setTab('all')
      setStep('map')
    } catch (error) {
      setSheet(null)
      setMapping([])
      setFileError(error instanceof Error ? error.message : 'The file could not be read.')
    } finally {
      setIsParsing(false)
    }
  }

  const resetWizard = () => {
    setStep('file')
    setSheet(null)
    setMapping([])
    setResult(null)
    setResultValidation(null)
    setFileError(null)
    setTab('all')
    importMutation.reset()
  }

  const exportErrors = (source: ValidationResult | null) => {
    if (!sheet || !source) return
    downloadCsv(
      `import-errors-${sheet.fileName.replace(/\.[^.]+$/, '')}.csv`,
      buildErrorReportCsv(sheet, mapping, source.rows),
    )
  }

  const missing = missingRequiredFields(mapping)

  return (
    <div>
      <PageHeader
        title={t('adminImport.title')}
        description={t('adminImport.description')}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv('talentverify-candidate-import-template.csv', buildImportTemplateCsv())
            }
          >
            <Download className="h-4 w-4" />
            {t('adminImport.downloadTemplate')}
          </Button>
        }
      />

      <StepBar step={step} t={t} />

      {step === 'file' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
          <Card>
            <CardBody className="space-y-4">
              <FileUpload
                accept=".csv,.tsv,.txt,.xlsx"
                maxSizeMb={10}
                disabled={isParsing}
                label={t('adminImport.uploadLabel')}
                hint={t('adminImport.uploadHint')}
                onFile={(file) => void handleFile(file)}
              />
              {isParsing && <p className="text-sm text-muted">{t('adminImport.parsing')}</p>}
              {fileError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              <div className="rounded-xl border border-border bg-slate-50/60 p-4">
                <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <Info className="h-4 w-4" />
                  {t('adminImport.howItWorks')}
                </h3>
                <ul className="space-y-1.5 text-sm text-muted">
                  <li>• {t('adminImport.rule1')}</li>
                  <li>• {t('adminImport.rule2')}</li>
                  <li>• {t('adminImport.rule3')}</li>
                  <li>• {t('adminImport.rule4')}</li>
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-foreground">
                {t('adminImport.columnReference')}
              </h2>
            </CardHeader>
            <CardBody className="max-h-[520px] space-y-3 overflow-y-auto">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {isArabic ? field.labelAr : field.label}
                    </span>
                    <Badge variant={field.required ? 'primary' : 'default'}>
                      {field.required ? t('adminImport.required') : t('adminImport.optional')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {isArabic ? field.hintAr : field.hint}
                  </p>
                  <p className="mt-1 text-xs text-muted" dir="ltr">
                    {t('adminImport.example')}: {field.example}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {step === 'map' && sheet && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-foreground">{t('adminImport.mapTitle')}</h2>
                <p className="text-sm text-muted">{t('adminImport.mapDescription')}</p>
              </div>
              <Badge variant="primary">
                {sheet.rows.length} {t('adminImport.fileSummary')} {sheet.fileName}
              </Badge>
            </div>

            {missing.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('adminImport.missingRequired')}{' '}
                  {missing
                    .map((key) => {
                      const field = IMPORT_FIELDS.find((item) => item.key === key)
                      return isArabic ? field?.labelAr : field?.label
                    })
                    .join(', ')}
                </span>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('adminImport.fileColumn')}</th>
                    <th className="px-4 py-3 font-medium">{t('adminImport.sample')}</th>
                    <th className="px-4 py-3 font-medium">{t('adminImport.mappedTo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sheet.headers.map((header, index) => (
                    <tr key={`${header}-${index}`}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {header || `#${index + 1}`}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-muted" dir="auto">
                        {sheet.rows.find((row) => row[index])?.[index] ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="h-9 w-full max-w-[260px] rounded-lg border border-border bg-white px-2 text-sm"
                          value={mapping[index] ?? ''}
                          onChange={(event) => {
                            const value = (event.target.value || null) as ImportFieldKey | null
                            setMapping((current) =>
                              current.map((existing, cursor) => {
                                if (cursor === index) return value
                                return value && existing === value ? null : existing
                              }),
                            )
                          }}
                        >
                          <option value="">{t('adminImport.ignoreColumn')}</option>
                          {IMPORT_FIELDS.map((field) => (
                            <option key={field.key} value={field.key}>
                              {isArabic ? field.labelAr : field.label}
                              {field.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={resetWizard}>
                <ArrowLeft className="h-4 w-4" />
                {t('adminImport.backToFile')}
              </Button>
              <Button disabled={missing.length > 0} onClick={() => setStep('preview')}>
                {t('adminImport.continueToPreview')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'preview' && sheet && validation && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryTile
              icon={FileSpreadsheet}
              label={t('adminImport.totalRows')}
              value={validation.summary.total}
            />
            <SummaryTile
              icon={CheckCircle2}
              label={t('adminImport.readyToImport')}
              value={validation.summary.valid}
              tone="success"
            />
            <SummaryTile
              icon={AlertTriangle}
              label={t('adminImport.invalidRows')}
              value={validation.summary.errors}
              tone="danger"
            />
            <SummaryTile
              icon={Copy}
              label={t('adminImport.duplicateRows')}
              value={
                validation.summary.duplicatesInFile + validation.summary.existingCandidates
              }
              tone="warning"
            />
            <SummaryTile
              icon={ShieldCheck}
              label={t('adminImport.conflictRows')}
              value={validation.summary.conflicts}
              tone="warning"
            />
          </div>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {t('adminImport.previewTitle')}
                  </h2>
                  <p className="text-sm text-muted">{t('adminImport.previewDescription')}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', 'adminImport.tabAll', validation.summary.total],
                    ['valid', 'adminImport.tabValid', validation.summary.valid],
                    ['errors', 'adminImport.tabErrors', validation.summary.errors],
                    [
                      'duplicates',
                      'adminImport.tabDuplicates',
                      validation.summary.duplicatesInFile +
                        validation.summary.existingCandidates,
                    ],
                    ['conflicts', 'adminImport.tabConflicts', validation.summary.conflicts],
                  ] as [PreviewTab, string, number][]
                ).map(([key, labelKey, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === key
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-border bg-white text-muted hover:bg-slate-50',
                    )}
                  >
                    {t(labelKey)} ({count})
                  </button>
                ))}
              </div>

              <RowTable
                rows={validation.rows.filter((row) => tabFilter(tab, row))}
                t={t}
                isArabic={isArabic}
              />

              {importMutation.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t('adminImport.importFailed')}{' '}
                    {importMutation.error instanceof Error
                      ? importMutation.error.message
                      : ''}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setStep('map')}>
                    <ArrowLeft className="h-4 w-4" />
                    {t('adminImport.backToMapping')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={validation.summary.total === validation.summary.valid}
                    onClick={() => exportErrors(validation)}
                  >
                    <Download className="h-4 w-4" />
                    {t('adminImport.exportErrors')}
                  </Button>
                </div>
                <Button
                  isLoading={importMutation.isPending}
                  disabled={readyRows.length === 0}
                  onClick={() => importMutation.mutate()}
                >
                  <Upload className="h-4 w-4" />
                  {readyRows.length === 0
                    ? t('adminImport.nothingToImport')
                    : `${t('adminImport.importValid')} (${readyRows.length})`}
                </Button>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                {t('adminImport.privacyNotice')}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {step === 'result' && result && (
        <Card>
          <CardBody className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t('adminImport.resultTitle')}
                </h2>
                <p className="text-sm text-muted">
                  {t('adminImport.resultFile')}: {result.batch.fileName}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                icon={Users}
                label={t('adminImport.resultCreated')}
                value={result.batch.createdCount}
                tone="success"
              />
              <SummaryTile
                icon={Copy}
                label={t('adminImport.resultSkipped')}
                value={result.batch.skippedDuplicateCount}
                tone="warning"
              />
              <SummaryTile
                icon={ShieldCheck}
                label={t('adminImport.resultConflicts')}
                value={result.batch.conflictCount}
                tone="warning"
              />
              <SummaryTile
                icon={AlertTriangle}
                label={t('adminImport.resultErrors')}
                value={result.batch.errorCount}
                tone="danger"
              />
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
              {t('adminImport.privacyNotice')}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/admin/imported-candidates')}>
                <Users className="h-4 w-4" />
                {t('adminImport.viewImported')}
              </Button>
              <Button
                variant="secondary"
                disabled={
                  !resultValidation ||
                  resultValidation.summary.total === resultValidation.summary.valid
                }
                onClick={() => exportErrors(resultValidation)}
              >
                <Download className="h-4 w-4" />
                {t('adminImport.exportErrors')}
              </Button>
              <Button variant="ghost" onClick={resetWizard}>
                <Upload className="h-4 w-4" />
                {t('adminImport.importAnother')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function StepBar({ step, t }: { step: WizardStep; t: (key: string) => string }) {
  const steps: [WizardStep, string][] = [
    ['file', 'adminImport.step1'],
    ['map', 'adminImport.step2'],
    ['preview', 'adminImport.step3'],
    ['result', 'adminImport.step4'],
  ]
  const activeIndex = steps.findIndex(([key]) => key === step)

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map(([key, labelKey], index) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              index < activeIndex && 'bg-green-50 text-success',
              index === activeIndex && 'bg-primary text-white',
              index > activeIndex && 'bg-slate-100 text-muted',
            )}
          >
            {index + 1}
          </span>
          <span
            className={cn(
              'text-sm',
              index === activeIndex ? 'font-medium text-foreground' : 'text-muted',
            )}
          >
            {t(labelKey)}
          </span>
          {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Users
  label: string
  value: number
  tone?: 'default' | 'success' | 'danger' | 'warning'
}) {
  const tones = {
    default: 'bg-slate-100 text-foreground',
    success: 'bg-green-50 text-success',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-warning',
  } as const

  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
}

function RowTable({
  rows,
  t,
  isArabic,
}: {
  rows: ValidatedRow[]
  t: (key: string) => string
  isArabic: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        {t('adminImport.noRowsInTab')}
      </p>
    )
  }

  return (
    <div className="max-h-[520px] overflow-auto rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-border bg-slate-50">
          <tr>
            <th className="px-4 py-3 font-medium">{t('adminImport.row')}</th>
            <th className="px-4 py-3 font-medium">{t('adminImport.candidate')}</th>
            <th className="px-4 py-3 font-medium">{t('adminImport.status')}</th>
            <th className="px-4 py-3 font-medium">{t('adminImport.details')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const token = STATUS_TOKENS[row.status]
            return (
              <tr key={row.rowNumber} className="align-top">
                <td className="px-4 py-3 text-muted">{row.rowNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground" dir="auto">
                    {row.data?.fullName || row.values.fullName || '—'}
                  </p>
                  <p className="text-xs text-muted" dir="ltr">
                    {row.data?.email || row.values.email || '—'}
                  </p>
                  {row.data?.phone && (
                    <p className="text-xs text-muted" dir="ltr">
                      {row.data.phone}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={token.variant}>{t(token.labelKey)}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <p>{rowIssueText(row, isArabic ? 'ar' : 'en') || '—'}</p>
                  {row.match && row.match.differences.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {row.match.differences.map((difference) => (
                        <li key={difference.field} className="rounded bg-slate-50 px-2 py-1">
                          <span className="font-medium text-foreground">
                            {difference.field}
                          </span>
                          {': '}
                          {t('adminImport.existingValue')} “{difference.existing}” →{' '}
                          {t('adminImport.incomingValue')} “{difference.incoming}”
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
