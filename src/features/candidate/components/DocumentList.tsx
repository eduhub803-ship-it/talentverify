import { useContext } from 'react'
import { ExternalLink, FileText, Trash2 } from 'lucide-react'
import { formatDate, formatFileSize } from '@/lib/utils'
import type { DocumentType, TalentDocument } from '@/types/domain'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { LanguageContext } from '@/context/LanguageContext'

const typeLabels: Record<DocumentType, string> = {
  cv: 'CV',
  certificate: 'Certificate',
  experience: 'Experience',
}

export function DocumentList({
  documents,
  filterType,
  onDelete,
  canDelete,
}: {
  documents: TalentDocument[]
  filterType?: DocumentType
  onDelete?: (id: string) => void
  canDelete?: boolean
}) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const filtered = filterType
    ? documents.filter((d) => d.type === filterType)
    : documents

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t('documentList.emptyTitle')}
        description={t('documentList.emptyDescription')}
      />
    )
  }

  const openDocument = (doc: TalentDocument) => {
    if (doc.publicUrl) {
      window.open(doc.publicUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-white">
      {filtered.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{doc.fileName}</p>
              <p className="text-xs text-muted">
                {formatDate(doc.uploadedAt)}
                {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary">{t(typeLabels[doc.type])}</Badge>
            {doc.publicUrl && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => openDocument(doc)}
                aria-label={t('documentList.viewDocument')}
              >
                <ExternalLink className="h-4 w-4 text-muted" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => onDelete(doc.id)}
                aria-label={t('documentList.deleteDocument')}
              >
                <Trash2 className="h-4 w-4 text-muted" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
