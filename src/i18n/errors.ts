type TFunction = (key: string) => string

const exactMessageKeys: Record<string, string> = {
  'Enter a valid email': 'validation.email',
  'Password is required': 'validation.passwordRequired',
  'Password must be at least 8 characters': 'validation.passwordMin',
  'Name must be at least 2 characters': 'validation.fullNameMin',
  'You must agree to the Terms & Conditions': 'validation.termsRequired',
  'You must agree to the Privacy Policy': 'validation.privacyRequired',
  'Organization name is required for HR registration': 'validation.organizationRequired',
  'Title is required': 'validation.jobTitleRequired',
  'Description must be at least 20 characters': 'validation.jobDescriptionMin',
  'Location is required': 'validation.locationRequired',
  'Job type is required': 'validation.jobTypeRequired',
  'Password reset email could not be sent.': 'auth.error.passwordResetFailed',
  'Password could not be updated.': 'auth.error.passwordUpdateFailed',
  'Verification email could not be sent.': 'auth.error.verificationSendFailed',
  'Login failed': 'auth.error.loginFailed',
  'Registration failed': 'auth.error.registrationFailed',
}

export function localizeMessage(
  message: string | null | undefined,
  t: TFunction,
): string | undefined {
  if (!message) return undefined

  const exactKey = exactMessageKeys[message]
  if (exactKey) return t(exactKey)

  const normalized = message.toLowerCase()
  if (normalized.includes('email not confirmed')) return t('auth.error.emailNotConfirmed')
  if (normalized.includes('invalid login credentials')) {
    return t('auth.error.invalidCredentials')
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return t('auth.error.emailRegistered')
  }

  return message
}
