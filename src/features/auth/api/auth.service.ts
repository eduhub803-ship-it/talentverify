import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { mockDb } from '@/lib/api/mock-db'
import type { Profile, UserRole } from '@/types/domain'
import { useAuthStore } from '@/stores/auth-store'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  role: UserRole
  organizationName?: string
  agreeTerms?: boolean
  agreePrivacy?: boolean
}

export interface RegisterResult {
  profile: Profile | null
  email: string
  needsEmailConfirmation: boolean
}

function mapProfile(row: {
  id: string
  role: UserRole
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}): Profile {
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }
}

export const authService = {
  async getSessionProfile(): Promise<Profile | null> {
    if (!isSupabaseConfigured || !supabase) {
      const session = mockDb.getSession()
      if (!session) return null
      return mockDb.getProfile(session.userId) ?? null
    }

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (error || !data) return null
    return mapProfile(data)
  },

  async login(input: LoginInput): Promise<Profile> {
    if (!isSupabaseConfigured || !supabase) {
      const profile = mockDb.login(input.email, input.password)
      if (!profile) throw new Error('Invalid email or password.')
      useAuthStore.getState().setProfile(profile)
      return profile
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })
    if (error) throw new Error(error.message)

    const profile = await this.getSessionProfile()
    if (!profile) throw new Error('Profile not found.')
    useAuthStore.getState().setProfile(profile)
    return profile
  },

  async register(input: RegisterInput): Promise<RegisterResult> {
    if (input.role === 'admin' || input.role === 'super_admin') {
      throw new Error('Admin accounts cannot be self-registered.')
    }

    if (!isSupabaseConfigured || !supabase) {
      const profile = mockDb.register(input)
      useAuthStore.getState().setProfile(profile)
      return { profile, email: input.email, needsEmailConfirmation: false }
    }

    const baseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${baseUrl}/login?verified=1`,
        data: {
          full_name: input.fullName,
          role: input.role,
          organization_name: input.organizationName,
        },
      },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registration failed.')

    // Store consent records for required policies
    if (input.agreeTerms || input.agreePrivacy) {
      try {
        const consents = []
        if (input.agreeTerms) {
          consents.push({
            user_id: data.user.id,
            policy_key: 'terms_of_service',
            policy_version: '1.0',
            accepted: true,
            accepted_at: new Date().toISOString(),
            context: 'signup',
            locale: 'en',
          })
        }
        if (input.agreePrivacy) {
          consents.push({
            user_id: data.user.id,
            policy_key: 'privacy_policy',
            policy_version: '1.0',
            accepted: true,
            accepted_at: new Date().toISOString(),
            context: 'signup',
            locale: 'en',
          })
        }
        if (consents.length > 0) {
          await supabase.from('user_consents').insert(consents)
        }
      } catch (consentError) {
        console.error('Error storing consent:', consentError)
      }
    }

    // Create notification preferences for the new user
    try {
      await supabase.from('notification_preferences').insert({
        user_id: data.user.id,
        user_role: input.role,
        job_alerts: true,
        application_updates: true,
        employer_contact: true,
        career_services: true,
        account_updates: true,
        marketing_communications: false,
        applications: true,
        talent_requests: true,
        recruitment_services: true,
        organization_updates: true,
        hr_marketing: false,
      })
    } catch (prefError) {
      console.error('Error creating notification preferences:', prefError)
    }

    if (!data.session) {
      return { profile: null, email: input.email, needsEmailConfirmation: true }
    }

    const profile = await this.getSessionProfile()
    if (!profile) {
      const fallbackProfile = {
        id: data.user.id,
        role: input.role,
        email: input.email,
        fullName: input.fullName,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      }
      useAuthStore.getState().setProfile(fallbackProfile)
      return { profile: fallbackProfile, email: input.email, needsEmailConfirmation: false }
    }
    useAuthStore.getState().setProfile(profile)
    return { profile, email: input.email, needsEmailConfirmation: false }
  },

  async resendSignupConfirmation(email: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return

    const baseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${baseUrl}/login?verified=1`,
      },
    })
    if (error) throw new Error(error.message)
  },

  async sendPasswordReset(email: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return

    const baseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    })
    if (error) throw new Error(error.message)
  },

  async updatePassword(password: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.logout()
    } else {
      await supabase.auth.signOut()
    }
    useAuthStore.getState().clear()
  },

  getDashboardPath(role: UserRole): string {
    switch (role) {
      case 'candidate':
        return '/candidate'
      case 'hr':
        return '/hr'
      case 'admin':
      case 'super_admin':
        return '/admin'
      default:
        return '/'
    }
  },
}
