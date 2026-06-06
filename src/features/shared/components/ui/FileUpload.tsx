import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  accept?: string
  maxSizeMb?: number
  onFile: (file: File) => void
  disabled?: boolean
  label?: string
}

export function FileUpload({
  accept = '.pdf,.doc,.docx',
  maxSizeMb = 10,
  onFile,
  disabled,
  label = 'Drag and drop or click to upload',
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(
    (file: File) => {
      const maxBytes = maxSizeMb * 1024 * 1024
      if (file.size > maxBytes) {
        setError(`File must be under ${maxSizeMb}MB`)
        return false
      }
      setError(null)
      return true
    },
    [maxSizeMb],
  )

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (validate(file)) onFile(file)
  }

  return (
    <div className="space-y-2">
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors',
          dragOver ? 'border-primary bg-primary-50/50' : 'border-border bg-slate-50/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) handleFiles(e.dataTransfer.files)
        }}
      >
        <Upload className="mb-3 h-8 w-8 text-muted" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="mt-1 text-xs text-muted">PDF, DOC, DOCX up to {maxSizeMb}MB</span>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
