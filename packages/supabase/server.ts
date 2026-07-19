// Server-only. Never import this file from client components or client.ts.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient<Database>(supabaseUrl, serviceRoleKey)
}
