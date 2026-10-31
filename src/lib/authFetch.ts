import { supabase } from '@/lib/supabase'

/** Oturumun access token'ını Authorization başlığına ekleyerek fetch yapar
 *  (yetki kontrolü olan API'ler için; yalnızca istemci tarafında kullanın). */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
