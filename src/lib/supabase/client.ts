import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * Backend mode is derived from configuration, not from a second flag:
 *   both variables absent  -> Mock backend (local development, demo, tests)
 *   both variables present -> live Supabase
 * Anything in between is a configuration mistake, and silently running against
 * the Mock database while the developer believes they are on Supabase is the
 * expensive failure. Those cases throw instead.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function fail(message: string): never {
  throw new Error(
    `Supabase configuration error: ${message}\n` +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local ' +
      '(see .env.example), or remove both to run against the Mock backend.',
  )
}

if (Boolean(url) !== Boolean(anonKey)) {
  fail(
    url
      ? 'VITE_SUPABASE_URL is set but VITE_SUPABASE_ANON_KEY is missing.'
      : 'VITE_SUPABASE_ANON_KEY is set but VITE_SUPABASE_URL is missing.',
  )
}

if (url) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    fail(`VITE_SUPABASE_URL is not a valid URL (received "${url}").`)
  }
  if (parsed.protocol !== 'https:') {
    fail(`VITE_SUPABASE_URL must use https (received "${parsed.protocol}//").`)
  }
  if (url.includes('your-project')) {
    fail('VITE_SUPABASE_URL still holds the .env.example placeholder value.')
  }
}

// Vite inlines every VITE_* value into the browser bundle, so a privileged key
// here would be published to every visitor. Refuse to start instead.
if (anonKey && (anonKey.startsWith('sb_secret_') || anonKey.includes('service_role'))) {
  fail(
    'VITE_SUPABASE_ANON_KEY looks like a service-role or secret key. ' +
      'Only the publishable/anon key may reach the browser.',
  )
}

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null
