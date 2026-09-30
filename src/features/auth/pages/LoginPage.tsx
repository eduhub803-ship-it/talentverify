import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { loginSchema, type LoginForm } from '../schemas/auth.schema'
import { getDashboardPath, loginUser, resendSignupConfirmation } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
      ? 'Email confirmed. Sign in with your email and password.'
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
      setNotice('Verification email sent. Check your inbox for the latest link.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification email could not be sent.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your TalentVerify account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
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
            Resend verification email
          </Button>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  )
}
