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

  async register(input: RegisterInput): Promise<Profile> {
    if (input.role === 'admin') {
      throw new Error('Admin accounts cannot be self-registered.')
    }

    if (!isSupabaseConfigured || !supabase) {
      const profile = mockDb.register(input)
      useAuthStore.getState().setProfile(profile)
      return profile
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          role: input.role,
          organization_name: input.organizationName,
        },
      },
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Registration failed.')

    const profile = await this.getSessionProfile()
    if (!profile) {
      return {
        id: data.user.id,
        role: input.role,
        email: input.email,
        fullName: input.fullName,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      }
    }
    useAuthStore.getState().setProfile(profile)
    return profile
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
        return '/admin'
      default:
        return '/'
    }
  },
}
