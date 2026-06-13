import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

// Convenience export — only call from client-side code
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Role = 'admin' | 'bsy' | 'sup' | 'jr'

export interface Profile {
  id: string
  full_name: string
  role: Role
  color: string
  manager_id: string | null
  email: string | null
  push_token: string | null
}

export interface Task {
  id: string
  pid: string
  date: string
  time: string | null
  type: string
  customer: string | null
  description: string | null
  checkin_ts: string | null
  checkin_lat: number | null
  checkin_lng: number | null
  checkin_by: string | null
  checkin_address: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: { full_name: string }
}

export interface TaskNote {
  id: string
  task_id: string
  author_id: string
  text: string
  created_at: string
  profiles?: { full_name: string }
}

export interface BsySupervisor {
  id: string
  bsy_id: string
  sup_id: string
}
