import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Nihai Prim Listesi — Ödendi bilgisi (kalıcı).
// GET  ?yil=YYYY  → o yılın tüm ödeme kayıtları
// POST { yil, ay, kullanici_tipi, kullanici_adi, odendi, odeme_tarihi, updated_by }
//   → upsert. Yalnızca admin ve İK (İnsan Kaynakları) yazabilir; updated_by
//     profilinin rolü sunucuda doğrulanır.

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface NihaiPrimOdemeRow {
  yil: number
  ay: number
  kullanici_tipi: string
  kullanici_adi: string
  odendi: boolean
  odeme_tarihi: string | null
}

export async function GET(req: Request) {
  const yil = parseInt(new URL(req.url).searchParams.get('yil') ?? String(new Date().getFullYear()))
  const sb = getSupabase()
  const { data, error } = await sb
    .from('nihai_prim_odeme')
    .select('yil, ay, kullanici_tipi, kullanici_adi, odendi, odeme_tarihi')
    .eq('yil', yil)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: (data ?? []) as NihaiPrimOdemeRow[] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { yil, ay, kullanici_tipi, kullanici_adi, odendi, odeme_tarihi, updated_by } = body as {
      yil: number; ay: number; kullanici_tipi: string; kullanici_adi: string
      odendi: boolean; odeme_tarihi: string | null; updated_by?: string
    }

    if (!yil || !ay || !kullanici_tipi || !kullanici_adi) {
      return NextResponse.json({ error: 'Eksik alan' }, { status: 400 })
    }
    if (!updated_by) {
      return NextResponse.json({ error: 'Yetki bilgisi eksik' }, { status: 401 })
    }

    const sb = getSupabase()

    // Yetki: yalnızca admin ve İK
    const { data: prof } = await sb.from('profiles').select('role').eq('id', updated_by).single()
    if (!prof || (prof.role !== 'admin' && prof.role !== 'ik')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { error } = await sb
      .from('nihai_prim_odeme')
      .upsert({
        yil, ay, kullanici_tipi, kullanici_adi,
        odendi: !!odendi,
        odeme_tarihi: odendi ? (odeme_tarihi ?? null) : null,
        updated_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'yil,ay,kullanici_tipi,kullanici_adi' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
