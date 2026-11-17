import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/apiAuth'

// Şube yetkisi (elle) — merch personeli olmayan şubelerin süpervizör / Jr ataması.
// GET → atamalar (giriş yapmış herkes) · POST / DELETE → yalnızca yönetici
// Tablo: sube_yetki (sube_yetki_migration.sql)

function istemci(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
  )
}
const tabloYok = (code?: string) => code === '42P01' || code === 'PGRST205'
const tabloHatasi = () => NextResponse.json(
  { error: 'Şube yetki tablosu henüz oluşturulmadı (sube_yetki_migration.sql çalıştırılmalı).', tabloYok: true },
  { status: 503 },
)

export async function GET(req: Request) {
  const user = await requireRole(req, ['admin', 'bsy', 'sup', 'jr', 'merch', 'manager', 'ik'])
  if (user instanceof NextResponse) return user
  const { data, error } = await istemci(req).from('sube_yetki').select('*').order('cari_adi').order('sube_adi')
  if (error) return tabloYok(error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atamalar: data ?? [] })
}

export async function POST(req: Request) {
  const user = await requireRole(req, ['admin'])
  if (user instanceof NextResponse) return user
  const b = await req.json().catch(() => null) as
    { sube_kod?: string; cari_adi?: string; sube_adi?: string; sup_adi?: string; jr_adi?: string } | null
  const sube_kod = (b?.sube_kod ?? '').trim()
  if (!sube_kod || (!b?.sup_adi?.trim() && !b?.jr_adi?.trim())) {
    return NextResponse.json({ error: 'Şube kodu ve süpervizör (ya da Jr) gerekli' }, { status: 400 })
  }
  const { error } = await istemci(req).from('sube_yetki').upsert({
    sube_kod,
    cari_adi: b!.cari_adi?.trim() || null,
    sube_adi: b!.sube_adi?.trim() || null,
    sup_adi: b!.sup_adi?.trim() || null,
    jr_adi: b!.jr_adi?.trim() || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'sube_kod' })
  if (error) return tabloYok(error.code) ? tabloHatasi() : NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const user = await requireRole(req, ['admin'])
  if (user instanceof NextResponse) return user
  const b = await req.json().catch(() => null) as { sube_kod?: string } | null
  if (!b?.sube_kod) return NextResponse.json({ error: 'sube_kod gerekli' }, { status: 400 })
  const { error } = await istemci(req).from('sube_yetki').delete().eq('sube_kod', b.sube_kod)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
