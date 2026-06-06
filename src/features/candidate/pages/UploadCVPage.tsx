import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { fetchMyDocuments, removeCandidateDocument, uploadCandidateDocument } from '../actions'
import { DocumentList } from '../components/DocumentList'

export function UploadCVPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  const upload = useMutation({
    mutationFn: (file: File) => uploadCandidateDocument(userId, file, 'cv'),
    onSuccess: () => {
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

  return (
    <div>
      <PageHeader
        title={t('uploadCv.title')}
        description={t('uploadCv.description')}
      />
      <Card className="mb-6">
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('uploadCv.templateTitle')}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t('uploadCv.templateDescription')}
            </p>
          </div>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li>{t('uploadCv.templateFeatureAts')}</li>
            <li>{t('uploadCv.templateFeatureProfessional')}</li>
            <li>{t('uploadCv.templateFeatureClean')}</li>
            <li>{t('uploadCv.templateFeatureStandardized')}</li>
            <li>{t('uploadCv.templateFeatureEditable')}</li>
            <li>{t('uploadCv.templateFeatureUploadAgain')}</li>
          </ul>
          <a
            href="/templates/talentverify-cv-template.docx"
            download
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Download className="h-4 w-4" />
            {t('uploadCv.downloadTemplate')}
          </a>
        </CardBody>
      </Card>
      <FileUpload
        label={t('uploadCv.uploadLabel')}
        accept=".pdf,.doc,.docx"
        disabled={upload.isPending || !canEdit}
        onFile={(file) => upload.mutate(file)}
      />
      {upload.isError && (
        <p className="mt-2 text-sm text-red-600">
          {upload.error instanceof Error ? upload.error.message : t('uploadCv.uploadFailed')}
        </p>
      )}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">{t('uploadCv.yourCv')}</h2>
        <DocumentList
          documents={documents}
          filterType="cv"
          canDelete
          onDelete={(id) => remove.mutate(id)}
        />
      </div>
    </div>
  )
}
