import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { loginSchema, type LoginForm } from '../schemas/auth.schema'
import { getDashboardPath, loginUser } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    try {
      const profile = await loginUser(data)
      const from = (location.state as { from?: string })?.from
      navigate(from ?? getDashboardPath(profile.role), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
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
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Register
        </Link>
      </p>
      <div className="mt-8 rounded-lg border border-border bg-slate-50 p-4 text-xs text-muted">
        <p className="font-medium text-foreground">Demo accounts</p>
        <ul className="mt-2 space-y-1">
          <li>Candidate: candidate@demo.com / demo12345</li>
          <li>HR: hr@demo.com / demo12345</li>
          <li>Admin: admin@talentverify.com / admin12345</li>
        </ul>
      </div>
    </AuthLayout>
  )
}
