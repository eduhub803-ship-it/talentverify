import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '../components/AuthLayout'
import { resetPasswordSchema, type ResetPasswordForm } from '../schemas/auth.schema'
import { updatePassword } from '../actions'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'

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
      title="Set new password"
      subtitle="Choose a new password for your TalentVerify account."
    >
      {isComplete ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated. Sign in with your new password.
          </p>
          <Link to="/login">
            <Button type="button" className="w-full">
              Sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
