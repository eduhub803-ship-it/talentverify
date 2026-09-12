import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { forgotPasswordSchema, type ForgotPasswordForm } from '../schemas/auth.schema'
import { sendPasswordReset } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'

export function ForgotPasswordPage() {
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
      title="Reset your password"
      subtitle="Enter your account email to receive a recovery link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        {sentEmail && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Recovery email sent to {sentEmail}. Open the link to set a new password.
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Send recovery email
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered your password?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
