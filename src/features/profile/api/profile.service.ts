import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { Profile } from '@/types/domain'

/** Turns the prepared data URL back into bytes for object storage. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export const profileService = {
  /**
   * Stores the prepared avatar. Mock keeps the data URL in local storage;
   * Supabase uploads to the `avatars` bucket and stores the public URL.
   */
  async setAvatar(userId: string, dataUrl: string | null): Promise<Profile> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.setProfileAvatar(userId, dataUrl)
    }

    let avatarUrl: string | null = null

    if (dataUrl) {
      const path = `${userId}/avatar-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error

    return {
      id: data.id,
      role: data.role,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
    }
  },
}
