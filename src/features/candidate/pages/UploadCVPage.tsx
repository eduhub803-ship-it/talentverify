import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeCandidateDocument(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] }),
  })

  const canEdit = !isLoading

  return (
    <div>
      <PageHeader
        title={t('uploadCv.title')}
        description={t('uploadCv.description')}
      />
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
