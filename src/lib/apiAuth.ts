import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API yetki kontrolü (sunucu tarafı). İstemci isteği `authFetch` ile atar;
// burada Authorization: Bearer <oturum access_token> doğrulanır ve kullanıcının
// profil rolü okunur. Kimlik istemcinin gönderdiği bir id'ye değil, oturuma dayanır.

export type ApiUser = { id: string; role: string }

export const ROLLER = {
  ADMIN:       ['admin'],
  ADMIN_IK:    ['admin', 'ik'],
  ADMIN_SUP:   ['admin', 'sup'],
  ADMIN_BSY:   ['admin', 'bsy'],
  // Saha rolleri — Çetinler Merch (yalnızca Sellout görüntüler) hariç herkes
  MERCH_HARIC: ['admin', 'bsy', 'sup', 'jr', 'manager', 'ik'],
} as const

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

/** Oturumu doğrular; rol izinliyse kullanıcıyı, değilse 401/403 yanıtını döner. */
export async function requireRole(req: Request, roles: readonly string[]): Promise<ApiUser | NextResponse> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
  const sb = anonClient()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'Oturum geçersiz' }, { status: 401 })
  const { data: prof } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
  const role = (prof?.role as string) ?? ''
  if (!roles.includes(role)) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  return { id: data.user.id, role }
}
