// Server-only. Do not import from client components.
import { createServerClient } from '@supabase/ssr'
import type { Database } from './database.types'

type CookieAdapter = {
  getAll(): { name: string; value: string }[]
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void
}

export function createSupabaseServerClient(cookieAdapter: CookieAdapter) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter }
  )
}
