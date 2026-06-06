import { useContext, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { Button } from '@/features/shared/components/ui/Button'
import type { DocumentType } from '@/types/domain'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchMyDocuments,
  removeCandidateDocument,
  uploadCandidateDocument,
} from '../actions'
import { DocumentList } from '../components/DocumentList'

const tabs: { type: DocumentType; label: string }[] = [
  { type: 'certificate', label: 'Certificates' },
  { type: 'experience', label: 'Experience' },
]

export function UploadDocumentsPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<DocumentType>('certificate')
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: documents = [] } = useQuery({
    queryKey: ['candidate', 'documents', userId],
    queryFn: () => fetchMyDocuments(userId),
  })

  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: DocumentType }) =>
      uploadCandidateDocument(userId, file, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeCandidateDocument(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate', 'documents', userId] }),
  })

  return (
    <div>
      <PageHeader
        title={t('uploadDocuments.title')}
        description={t('uploadDocuments.description')}
      />

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.type}
            type="button"
            variant={activeTab === tab.type ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab(tab.type)}
          >
            {t(tab.label)}
          </Button>
        ))}
      </div>

      <FileUpload
        label={
          activeTab === 'certificate'
            ? t('uploadDocuments.uploadCertificate')
            : t('uploadDocuments.uploadExperience')
        }
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        disabled={upload.isPending}
        onFile={(file) => upload.mutate({ file, type: activeTab })}
      />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">
          {t('uploadDocuments.uploadedFiles')}
        </h2>
        <DocumentList
          documents={documents}
          filterType={activeTab}
          canDelete
          onDelete={(id) => remove.mutate(id)}
        />
      </div>
    </div>
  )
}
