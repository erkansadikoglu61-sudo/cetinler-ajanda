import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { merchHesapPlani, merchHesaplariOlustur } from '@/lib/merchHesap'

// Çetinler Merch kullanıcı hesapları (Kullanıcılar ▸ admin butonu).
// GET  → oluşturulacak hesap listesi (hiçbir şey oluşturmaz)
// POST → eksik hesapları oluşturur; yeni hesapların kullanıcı adı + şifresini
//        yalnızca bu yanıtta döndürür (hiçbir yerde saklanmaz).
// Yetki: Authorization: Bearer <oturum access_token> — kullanıcının rolü
// sunucuda 'admin' olarak doğrulanır.

export const maxDuration = 60

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function requireAdmin(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'Sunucuda yönetici anahtarı tanımlı değil', status: 500 }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return { error: 'Oturum bulunamadı', status: 401 }
  const sb = getAdminClient()
  const { data: u, error } = await sb.auth.getUser(token)
  if (error || !u.user) return { error: 'Oturum geçersiz', status: 401 }
  const { data: prof } = await sb.from('profiles').select('role').eq('id', u.user.id).single()
  if (prof?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok', status: 403 }
  return { sb }
}

export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if (!('sb' in a)) return NextResponse.json({ error: a.error }, { status: a.status })
  try {
    return NextResponse.json(await merchHesapPlani(a.sb!))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if (!('sb' in a)) return NextResponse.json({ error: a.error }, { status: a.status })
  try {
    return NextResponse.json(await merchHesaplariOlustur(a.sb!), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
