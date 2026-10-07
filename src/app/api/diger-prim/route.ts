import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Primler ▸ Diğer — manuel prim hakediş girişleri (diger_prim tablosu).
// GET    ?donem=YYYY-MM&user=<profileId>            → { rows }
// POST   { row: {id?, donem, kullanici_adi, cari_adi, sube_adi, gorev, sube_adet, hakedis}, updated_by } → upsert
// DELETE ?id=<uuid>&user=<profileId>                → sil
// Yalnızca admin; profil rolü sunucuda doğrulanır.

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type Sb = ReturnType<typeof getSupabase>

async function isAdmin(sb: Sb, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const { data } = await sb.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'admin'
}

const COLS = 'id, donem, kullanici_adi, cari_adi, sube_adi, gorev, sube_adet, hakedis, updated_at'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const donem = sp.get('donem') ?? ''
  if (!/^\d{4}-\d{2}$/.test(donem)) return NextResponse.json({ error: 'donem geçersiz' }, { status: 400 })
  const sb = getSupabase()
  if (!(await isAdmin(sb, sp.get('user')))) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  const { data, error } = await sb.from('diger_prim').select(COLS).eq('donem', donem).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const { row, updated_by } = await req.json() as {
      row: { id?: string; donem: string; kullanici_adi: string; cari_adi: string; sube_adi: string; gorev: string; sube_adet: number; hakedis: number }
      updated_by?: string
    }
    const sb = getSupabase()
    if (!(await isAdmin(sb, updated_by))) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    if (!/^\d{4}-\d{2}$/.test(row?.donem ?? '')) return NextResponse.json({ error: 'donem geçersiz' }, { status: 400 })

    const rec = {
      donem:         row.donem,
      kullanici_adi: (row.kullanici_adi ?? '').trim(),
      cari_adi:      (row.cari_adi ?? '').trim(),
      sube_adi:      (row.sube_adi ?? '').trim(),
      gorev:         (row.gorev ?? '').trim(),
      sube_adet:     Number(row.sube_adet) || 0,
      hakedis:       Number(row.hakedis) || 0,
      updated_by,
      updated_at:    new Date().toISOString(),
    }
    const q = row.id
      ? sb.from('diger_prim').update(rec).eq('id', row.id).select(COLS).single()
      : sb.from('diger_prim').insert(rec).select(COLS).single()
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ row: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const sp = new URL(req.url).searchParams
  const id = sp.get('id')
  const sb = getSupabase()
  if (!(await isAdmin(sb, sp.get('user')))) return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  if (!id) return NextResponse.json({ error: 'id eksik' }, { status: 400 })
  const { error } = await sb.from('diger_prim').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
