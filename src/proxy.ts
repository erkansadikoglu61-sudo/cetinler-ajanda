import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Tüm /api/* uçları giriş gerektirir: Authorization: Bearer <Supabase oturum token'ı>.
// İstemcideki tüm /api istekleri token'ı otomatik ekler (components/ApiAuthFetch).
// Rol bazlı kısıtlar ayrıca ilgili route'larda (lib/apiAuth requireRole).
//
// İstisna: Vercel cron (/api/sellout önbellek ısıtma) — Vercel, CRON_SECRET ortam
// değişkeni tanımlıysa onu "Bearer" olarak gönderir.

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export async function proxy(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })

  const cron = process.env.CRON_SECRET
  if (cron && token === cron) return NextResponse.next()

  // getClaims: imzayı doğrular (asimetrik anahtarlarda yerel JWKS, aksi halde Auth sunucusu)
  const { data, error } = await sb.auth.getClaims(token)
  if (error || !data?.claims?.sub) return NextResponse.json({ error: 'Oturum geçersiz' }, { status: 401 })
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
