import { create } from 'zustand'
import type { Profile } from '@/types/domain'

interface AuthState {
  profile: Profile | null
  isHydrated: boolean
  setProfile: (profile: Profile | null) => void
  setHydrated: (value: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isHydrated: false,
  setProfile: (profile) => set({ profile }),
  setHydrated: (isHydrated) => set({ isHydrated }),
  clear: () => set({ profile: null }),
}))
