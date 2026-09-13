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

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const languageCtx = useContext(LanguageContext)
  const language = languageCtx?.lang || 'en'
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
      setResendStatus('Verification email sent. Check your inbox for the latest link.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification email could not be sent.')
    } finally {
      setIsResending(false)
    }
  }

  if (confirmationEmail) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="Confirm your email address to activate your TalentVerify account."
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            Verification email sent to {confirmationEmail}. After confirming, sign in
            with your email and password.
          </div>
          {resendStatus && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {resendStatus}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            isLoading={isResending}
            onClick={onResendConfirmation}
          >
            Resend verification email
          </Button>
          <Link to="/login">
            <Button type="button" className="w-full">
              Sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join TalentVerify as a candidate or HR organization"
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
              {r === 'candidate' ? 'Candidate' : 'HR Organization'}
            </label>
          ))}
        </div>

        <Input
          label="Full name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          hint="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />
        {role === 'hr' && (
          <Input
            label="Organization name"
            error={errors.organizationName?.message}
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
              {language === 'ar'
                ? 'أوافق على '
                : 'I agree to the '}
              <Link to="/legal/terms" target="_blank" className="font-medium text-blue-600 hover:underline">
                {language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
              </Link>
              {errors.agreeTerms && (
                <span className="ml-2 text-xs text-red-600">{errors.agreeTerms.message}</span>
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
              {language === 'ar'
                ? 'أقرّ بـ '
                : 'I acknowledge the '}
              <Link to="/legal/privacy" target="_blank" className="font-medium text-blue-600 hover:underline">
                {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </Link>
              {language === 'ar'
                ? ' وأوافق على معالجة بيانات الحساب'
                : ' and agree to necessary data processing'}
              {errors.agreePrivacy && (
                <span className="ml-2 text-xs text-red-600">{errors.agreePrivacy.message}</span>
              )}
            </span>
          </label>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {language === 'ar' ? 'إنشاء حساب' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
