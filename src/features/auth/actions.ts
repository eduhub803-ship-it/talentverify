import {
  authService,
  type LoginInput,
  type RegisterInput,
  type RegisterResult,
} from './api/auth.service'
import type { Profile } from '@/types/domain'

export async function loginUser(input: LoginInput): Promise<Profile> {
  return authService.login(input)
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  return authService.register(input)
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  return authService.resendSignupConfirmation(email)
}

export async function sendPasswordReset(email: string): Promise<void> {
  return authService.sendPasswordReset(email)
}

export async function updatePassword(password: string): Promise<void> {
  return authService.updatePassword(password)
}

export async function logoutUser(): Promise<void> {
  return authService.logout()
}

export async function hydrateSession(): Promise<Profile | null> {
  return authService.getSessionProfile()
}

export function getDashboardPath(role: Profile['role']): string {
  return authService.getDashboardPath(role)
}
