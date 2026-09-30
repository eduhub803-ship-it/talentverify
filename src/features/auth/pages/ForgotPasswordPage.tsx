import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { forgotPasswordSchema, type ForgotPasswordForm } from '../schemas/auth.schema'
import { sendPasswordReset } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { localizeMessage } from '@/i18n/errors'

export function ForgotPasswordPage() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [error, setError] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setError(null)
    try {
      await sendPasswordReset(data.email)
      setSentEmail(data.email)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password reset email could not be sent.')
    }
  }

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={localizeMessage(errors.email?.message, t)}
          {...register('email')}
        />
        {sentEmail && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {t('auth.forgot.sent').replace('{email}', sentEmail)}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {localizeMessage(error, t)}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {t('auth.forgot.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.forgot.remembered')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.signIn.submit')}
        </Link>
      </p>
    </AuthLayout>
  )
}
