import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { UsageFeature, UsageLimit } from '@/types/domain'

export const usageLimitsService = {
  async getUsage(userId: string, feature: UsageFeature): Promise<UsageLimit> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.getUsageLimit(userId, feature)
    }

    const { data, error } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('feature', feature)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return { userId, feature, count: 0, updatedAt: new Date().toISOString() }
    }

    return {
      userId: data.user_id,
      feature: data.feature as UsageFeature,
      count: data.count,
      updatedAt: data.updated_at,
    }
  },

  async increment(userId: string, feature: UsageFeature): Promise<UsageLimit> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.incrementUsage(userId, feature)
    }

    const current = await this.getUsage(userId, feature)
    const next = current.count + 1
    const updatedAt = new Date().toISOString()

    const { data, error } = await supabase
      .from('usage_limits')
      .upsert(
        {
          user_id: userId,
          feature,
          count: next,
          updated_at: updatedAt,
        },
        { onConflict: 'user_id,feature' },
      )
      .select()
      .single()

    if (error) throw error

    return {
      userId: data.user_id,
      feature: data.feature as UsageFeature,
      count: data.count,
      updatedAt: data.updated_at,
    }
  },
}
