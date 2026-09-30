import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { resetPasswordSchema, type ResetPasswordForm } from '../schemas/auth.schema'
import { updatePassword } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { localizeMessage } from '@/i18n/errors'

function readAuthLinkError(): string | null {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    searchParams.get('error_description') ??
    hashParams.get('error_description') ??
    searchParams.get('error') ??
    hashParams.get('error')
  )
}

export function ResetPasswordPage() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [error, setError] = useState<string | null>(() => {
    const authError = readAuthLinkError()
    return authError ? decodeURIComponent(authError).replace(/\+/g, ' ') : null
  })
  const [isComplete, setIsComplete] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (data: ResetPasswordForm) => {
    setError(null)
    try {
      await updatePassword(data.password)
      setIsComplete(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password could not be updated.')
    }
  }

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
    >
      {isComplete ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {t('auth.reset.complete')}
          </p>
          <Link to="/login">
            <Button type="button" className="w-full">
              {t('auth.signIn.submit')}
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            hint={t('auth.passwordHint')}
            error={localizeMessage(errors.password?.message, t)}
            {...register('password')}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {localizeMessage(error, t)}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            {t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
