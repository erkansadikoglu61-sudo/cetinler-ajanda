import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseHtmlTableByHeader, num, fetchPhpHtml } from '@/lib/merchSatis'
import { normalizeName } from '@/lib/sellout'
import { requireRole, ROLLER } from '@/lib/apiAuth'

export const maxDuration = 60

const MERCH_SATIS_URL = 'https://b2b.cetinlerltd.com.tr/phprapor/export_merch_satis.php'

// Primler ▸ Diğer — manuel prim hakediş girişleri (diger_prim tablosu).
// GET    ?donem=YYYY-MM&user=<profileId>            → { rows, subeAdet }
//        subeAdet: { 'norm(cari)||norm(sube)': dönemdeki toplam satış adedi } (export_merch_satis)
// GET    ?donem=YYYY-MM&user=<profileId>&mode=odeme → { rows } (Prim Ödeme Listesi; satış verisi çekilmez)
//        Prim Ödeme'yi gören roller okuyabilir (admin/bsy/sup/ik); rol filtresi istemcide.
// POST   { row: {id?, donem, kullanici_adi, grup, cari_adi, sube_adi, gorev, sube_adet, hakedis}, updated_by } → upsert
// DELETE ?id=<uuid>&user=<profileId>                → sil
// Yalnızca admin; rol oturumdan (Authorization: Bearer) sunucuda doğrulanır.
// (Önceden istemcinin gönderdiği user/updated_by id'sine güveniliyordu — taklit edilebilirdi.)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const ODEME_ROLLERI = ['admin', 'bsy', 'sup', 'ik']

const COLS = 'id, donem, kullanici_adi, grup, cari_adi, sube_adi, gorev, sube_adet, hakedis, updated_at'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const donem = sp.get('donem') ?? ''
  if (!/^\d{4}-\d{2}$/.test(donem)) return NextResponse.json({ error: 'donem geçersiz' }, { status: 400 })
  const odeme = sp.get('mode') === 'odeme'
  const yetki = await requireRole(req, odeme ? ODEME_ROLLERI : ROLLER.ADMIN)
  if (yetki instanceof NextResponse) return yetki
  const sb = getSupabase()
  const { data, error } = await sb.from('diger_prim').select(COLS).eq('donem', donem).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (odeme) return NextResponse.json({ rows: data ?? [] })

  // Dönemde şube (cari+şube) bazında toplam satış adedi — "Şubenin Adeti" otomatik
  const subeAdet: Record<string, number> = {}
  try {
    const { rows } = parseHtmlTableByHeader(await fetchPhpHtml(MERCH_SATIS_URL))
    for (const r of rows) {
      if (r['DONEM'] !== donem) continue
      const k = `${normalizeName(r['CARI_ISIM'] ?? '')}||${normalizeName(r['SUBE_ADI'] ?? '')}`
      subeAdet[k] = (subeAdet[k] ?? 0) + num(r['SATILAN_ADET'])
    }
  } catch { /* satış verisi alınamazsa adetler boş kalır */ }

  return NextResponse.json({ rows: data ?? [], subeAdet })
}

export async function POST(req: Request) {
  const yetki = await requireRole(req, ROLLER.ADMIN)
  if (yetki instanceof NextResponse) return yetki
  try {
    const { row } = await req.json() as {
      row: { id?: string; donem: string; kullanici_adi: string; grup: string; cari_adi: string; sube_adi: string; gorev: string; sube_adet: number; hakedis: number }
    }
    const updated_by = yetki.id
    const sb = getSupabase()
    if (!/^\d{4}-\d{2}$/.test(row?.donem ?? '')) return NextResponse.json({ error: 'donem geçersiz' }, { status: 400 })

    const rec = {
      donem:         row.donem,
      kullanici_adi: (row.kullanici_adi ?? '').trim(),
      grup:          (row.grup ?? '').trim(),
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
  const yetki = await requireRole(req, ROLLER.ADMIN)
  if (yetki instanceof NextResponse) return yetki
  const sb = getSupabase()
  if (!id) return NextResponse.json({ error: 'id eksik' }, { status: 400 })
  const { error } = await sb.from('diger_prim').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
