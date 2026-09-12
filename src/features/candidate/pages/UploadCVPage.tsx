import { useContext, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/features/shared/components/ui/Card'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { formatDate, formatFileSize } from '@/lib/utils'
import {
  fetchMyDocuments,
  removeCandidateDocument,
  replaceCandidateCvDocument,
  uploadCandidateDocument,
} from '../actions'
import { DocumentList } from '../components/DocumentList'
import {
  CV_MAX_SIZE_MB,
  CV_TEMPLATE,
  getActiveCvDocument,
  getDocumentFileType,
  getPreviousCvDocuments,
  validateCvFile,
} from '../cv-workflow'

export function UploadCVPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const [showReplace, setShowReplace] = useState(false)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  const upload = useMutation({
    mutationFn: (file: File) => uploadCandidateDocument(userId, file, 'cv'),
    onSuccess: () => {
      setShowReplace(false)
      qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  const replace = useMutation({
    mutationFn: ({ currentDocumentId, file }: { currentDocumentId: string; file: File }) =>
      replaceCandidateCvDocument(userId, currentDocumentId, file),
    onSuccess: () => {
      setShowReplace(false)
      qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeCandidateDocument(userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  const canEdit = !isLoading
  const currentCv = useMemo(() => getActiveCvDocument(documents), [documents])
  const previousCvs = useMemo(() => getPreviousCvDocuments(documents), [documents])
  const currentMutationError = replace.error ?? upload.error ?? remove.error
  const validationMessage = (file: File) => validateCvFile(file).message

  const openCurrentCv = () => {
    if (currentCv?.publicUrl) {
      window.open(currentCv.publicUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div>
      <PageHeader
        title={t('uploadCv.title')}
        description={t('uploadCv.description')}
      />
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">
            {t(CV_TEMPLATE.titleKey)}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">
            {t(CV_TEMPLATE.descriptionKey)}
          </p>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li>{t('uploadCv.templateFeatureAts')}</li>
            <li>{t('uploadCv.templateFeatureLanguage')}</li>
            <li>{t('uploadCv.templateFeatureClean')}</li>
            <li>{t('uploadCv.templateFeatureStandardized')}</li>
            <li>{t('uploadCv.templateFeatureEditable')}</li>
            <li>{t('uploadCv.templateFeatureUploadAgain')}</li>
          </ul>
          <div>
            <a
              href={CV_TEMPLATE.href}
              download={CV_TEMPLATE.filename}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Download className="h-4 w-4" />
              {t(CV_TEMPLATE.labelKey)}
            </a>
          </div>
          <p className="text-xs text-muted">{t('uploadCv.templateNote')}</p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">
            {t('uploadCv.currentCv')}
          </h2>
        </CardHeader>
        <CardBody>
          {currentCv ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-foreground">{currentCv.fileName}</p>
                  <Badge variant="primary">{getDocumentFileType(currentCv)}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {t('uploadCv.uploadedOn')} {formatDate(currentCv.uploadedAt)}
                  {currentCv.fileSize != null && ` · ${formatFileSize(currentCv.fileSize)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!currentCv.publicUrl}
                  onClick={openCurrentCv}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('uploadCv.openCv')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowReplace((value) => !value)}
                  disabled={!canEdit || replace.isPending || upload.isPending}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('uploadCv.replaceCv')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => remove.mutate(currentCv.id)}
                  disabled={!canEdit || remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('uploadCv.deleteCv')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{t('uploadCv.noCurrentCv')}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">
            {currentCv ? t('uploadCv.replaceUploadTitle') : t('uploadCv.uploadTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          {(!currentCv || showReplace) && (
            <FileUpload
              label={currentCv ? t('uploadCv.replaceUploadLabel') : t('uploadCv.uploadLabel')}
              accept=".pdf,.doc,.docx"
              maxSizeMb={CV_MAX_SIZE_MB}
              disabled={upload.isPending || replace.isPending || !canEdit}
              validateFile={validationMessage}
              onFile={(file) => {
                if (currentCv) {
                  replace.mutate({ currentDocumentId: currentCv.id, file })
                  return
                }
                upload.mutate(file)
              }}
            />
          )}
          {currentCv && !showReplace && (
            <p className="text-sm text-muted">{t('uploadCv.replaceHint')}</p>
          )}
        </CardBody>
      </Card>

      {currentMutationError && (
        <p className="mt-2 text-sm text-red-600">
          {currentMutationError instanceof Error
            ? currentMutationError.message
            : t('uploadCv.uploadFailed')}
        </p>
      )}

      {previousCvs.length > 0 && (
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">{t('uploadCv.previousCvs')}</h2>
        <DocumentList
          documents={previousCvs}
          filterType="cv"
          canDelete
          onDelete={(id) => remove.mutate(id)}
        />
      </div>
      )}
    </div>
  )
}
