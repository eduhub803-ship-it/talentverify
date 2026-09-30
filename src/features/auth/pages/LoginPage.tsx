import { useContext, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { loginSchema, type LoginForm } from '../schemas/auth.schema'
import { getDashboardPath, loginUser, resendSignupConfirmation } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { localizeMessage } from '@/i18n/errors'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const params = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const authError =
    params.get('error_description') ??
    hashParams.get('error_description') ??
    params.get('error') ??
    hashParams.get('error')
  const [error, setError] = useState<string | null>(
    authError ? decodeURIComponent(authError).replace(/\+/g, ' ') : null,
  )
  const [notice, setNotice] = useState<string | null>(
    !authError && params.get('verified') === '1'
      ? 'auth.signIn.confirmed'
      : null,
  )
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    setNotice(null)
    setUnconfirmedEmail(null)
    try {
      const profile = await loginUser(data)
      const from = (location.state as { from?: string })?.from
      navigate(from ?? getDashboardPath(profile.role), { replace: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed'
      setError(message)
      if (message.toLowerCase().includes('email not confirmed')) {
        setUnconfirmedEmail(data.email)
      }
    }
  }

  const onResendConfirmation = async () => {
    if (!unconfirmedEmail) return
    setIsResending(true)
    setNotice(null)
    try {
      await resendSignupConfirmation(unconfirmedEmail)
      setNotice('auth.notice.verificationSent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification email could not be sent.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthLayout title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={localizeMessage(errors.email?.message, t)}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={localizeMessage(errors.password?.message, t)}
          {...register('password')}
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {localizeMessage(error, t)}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice.startsWith('auth.') ? t(notice) : notice}
          </p>
        )}
        {unconfirmedEmail && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            isLoading={isResending}
            onClick={onResendConfirmation}
        >
            {t('auth.signIn.resend')}
          </Button>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {t('auth.signIn.submit')}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          {t('auth.signIn.forgotPassword')}
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-muted">
        {t('auth.signIn.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t('auth.signIn.register')}
        </Link>
      </p>
    </AuthLayout>
  )
}
