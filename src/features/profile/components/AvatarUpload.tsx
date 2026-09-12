import { useContext, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, Check, Trash2 } from 'lucide-react'
import { Button } from '@/features/shared/components/ui/Button'
import { Avatar } from '@/features/shared/components/ui/Avatar'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { AVATAR_ACCEPT, prepareAvatar, validateAvatarFile } from '../avatar'
import { removeProfileAvatar, saveProfileAvatar } from '../actions'

/**
 * Upload → preview → save → replace → remove, inline on an existing profile
 * surface rather than a page of its own.
 */
export function AvatarUpload() {
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const refresh = (next: typeof profile) => {
    if (next) setProfile(next)
    qc.invalidateQueries({ queryKey: ['candidate'] })
    qc.invalidateQueries({ queryKey: ['hr'] })
    qc.invalidateQueries({ queryKey: ['admin'] })
  }

  const save = useMutation({
    mutationFn: (dataUrl: string) =>
      saveProfileAvatar({ actor: profile, userId: profile!.id, dataUrl }),
    onSuccess: (next) => {
      refresh(next)
      setPreview(null)
      setError(null)
      setSaved(true)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'The photo could not be saved.',
      ),
  })

  const remove = useMutation({
    mutationFn: () => removeProfileAvatar({ actor: profile, userId: profile!.id }),
    onSuccess: (next) => {
      refresh(next)
      setPreview(null)
      setError(null)
      setSaved(false)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'The photo could not be removed.',
      ),
  })

  if (!profile) return null

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setSaved(false)
    const validation = validateAvatarFile(file)
    if (!validation.valid) {
      setError(validation.error)
      return
    }
    try {
      setError(null)
      setPreview(await prepareAvatar(file))
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : 'That image could not be read.',
      )
    }
  }

  const shown = preview ?? profile.avatarUrl
  const busy = save.isPending || remove.isPending

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar src={shown} name={profile.fullName} email={profile.email} size="lg" />

      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t('avatar.title')}</p>
          <p className="text-xs text-muted">{t('avatar.hint')}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={AVATAR_ACCEPT}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {profile.avatarUrl ? t('avatar.replace') : t('avatar.choose')}
          </Button>

          {preview && (
            <Button
              type="button"
              size="sm"
              isLoading={save.isPending}
              onClick={() => save.mutate(preview)}
            >
              {t('avatar.save')}
            </Button>
          )}

          {preview && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPreview(null)
                setError(null)
              }}
            >
              {t('avatar.discard')}
            </Button>
          )}

          {!preview && profile.avatarUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              isLoading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="h-4 w-4" />
              {t('avatar.remove')}
            </Button>
          )}
        </div>

        {preview && !error && (
          <p className="text-xs text-muted">{t('avatar.previewNote')}</p>
        )}
        {saved && !preview && !error && (
          <p className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" />
            {t('avatar.saved')}
          </p>
        )}
        {error && (
          <p className="inline-flex items-start gap-1 text-xs text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
