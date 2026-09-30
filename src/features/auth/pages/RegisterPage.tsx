import { useState, useContext } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { registerSchema, type RegisterForm } from '../schemas/auth.schema'
import { getDashboardPath, registerUser, resendSignupConfirmation } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { cn } from '@/lib/utils'
import { localizeMessage } from '@/i18n/errors'

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const languageCtx = useContext(LanguageContext)
  const t = languageCtx?.t ?? ((key: string) => key)
  const defaultRole = searchParams.get('role') === 'hr' ? 'hr' : 'candidate'
  const [error, setError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole, agreeTerms: false, agreePrivacy: false },
  })

  const role = useWatch({ control, name: 'role' })

  const onSubmit = async (data: RegisterForm) => {
    setError(null)
    try {
      const profile = await registerUser({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        organizationName: data.organizationName,
        agreeTerms: data.agreeTerms,
        agreePrivacy: data.agreePrivacy,
      })
      if (profile.needsEmailConfirmation) {
        setConfirmationEmail(profile.email)
        return
      }
      if (profile.profile) {
        navigate(getDashboardPath(profile.profile.role), { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    }
  }

  const onResendConfirmation = async () => {
    if (!confirmationEmail) return
    setIsResending(true)
    setResendStatus(null)
    setError(null)
    try {
      await resendSignupConfirmation(confirmationEmail)
      setResendStatus('auth.notice.verificationSent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification email could not be sent.')
    } finally {
      setIsResending(false)
    }
  }

  if (confirmationEmail) {
    return (
      <AuthLayout
        title={t('auth.register.checkEmailTitle')}
        subtitle={t('auth.register.checkEmailSubtitle')}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            {t('auth.register.emailSent').replace('{email}', confirmationEmail)}
          </div>
          {resendStatus && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {resendStatus.startsWith('auth.') ? t(resendStatus) : resendStatus}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {localizeMessage(error, t)}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            isLoading={isResending}
            onClick={onResendConfirmation}
          >
            {t('auth.signIn.resend')}
          </Button>
          <Link to="/login">
            <Button type="button" className="w-full">
              {t('auth.signIn.submit')}
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(['candidate', 'hr'] as const).map((r) => (
            <label
              key={r}
              className={cn(
                'cursor-pointer rounded-md px-3 py-2 text-center text-sm font-medium transition-colors',
                role === r
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground',
              )}
            >
              <input type="radio" value={r} className="sr-only" {...register('role')} />
              {r === 'candidate' ? t('auth.register.candidate') : t('auth.register.hr')}
            </label>
          ))}
        </div>

        <Input
          label={t('auth.fullName')}
          error={localizeMessage(errors.fullName?.message, t)}
          {...register('fullName')}
        />
        <Input
          label={t('auth.email')}
          type="email"
          error={localizeMessage(errors.email?.message, t)}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          hint={t('auth.passwordHint')}
          error={localizeMessage(errors.password?.message, t)}
          {...register('password')}
        />
        {role === 'hr' && (
          <Input
            label={t('auth.organizationName')}
            error={localizeMessage(errors.organizationName?.message, t)}
            {...register('organizationName')}
          />
        )}
        <div className="space-y-3 rounded-lg bg-slate-50 p-4">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 flex-shrink-0"
              {...register('agreeTerms')}
            />
            <span className="text-sm text-slate-700">
              {t('auth.register.termsPrefix')}
              <Link to="/legal/terms" target="_blank" className="font-medium text-blue-600 hover:underline">
                {t('auth.register.termsLink')}
              </Link>
              {errors.agreeTerms && (
                <span className="ml-2 text-xs text-red-600">
                  {localizeMessage(errors.agreeTerms.message, t)}
                </span>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 flex-shrink-0"
              {...register('agreePrivacy')}
            />
            <span className="text-sm text-slate-700">
              {t('auth.register.privacyPrefix')}
              <Link to="/legal/privacy" target="_blank" className="font-medium text-blue-600 hover:underline">
                {t('auth.register.privacyLink')}
              </Link>
              {t('auth.register.privacySuffix')}
              {errors.agreePrivacy && (
                <span className="ml-2 text-xs text-red-600">
                  {localizeMessage(errors.agreePrivacy.message, t)}
                </span>
              )}
            </span>
          </label>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {localizeMessage(error, t)}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.signIn.submit')}
        </Link>
      </p>
    </AuthLayout>
  )
}
