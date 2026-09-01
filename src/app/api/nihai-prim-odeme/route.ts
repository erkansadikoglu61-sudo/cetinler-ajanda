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

interface OdemeInput {
  yil: number; ay: number; kullanici_tipi: string; kullanici_adi: string
  odendi: boolean; odeme_tarihi: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const updated_by: string | undefined = body.updated_by

    // Tekli veya toplu (items dizisi)
    const items: OdemeInput[] = Array.isArray(body.items) ? body.items : [body]

    if (!updated_by) {
      return NextResponse.json({ error: 'Yetki bilgisi eksik' }, { status: 401 })
    }
    for (const it of items) {
      if (!it.yil || !it.ay || !it.kullanici_tipi || !it.kullanici_adi) {
        return NextResponse.json({ error: 'Eksik alan' }, { status: 400 })
      }
    }

    const sb = getSupabase()

    // Yetki: yalnızca admin ve İK
    const { data: prof } = await sb.from('profiles').select('role').eq('id', updated_by).single()
    if (!prof || (prof.role !== 'admin' && prof.role !== 'ik')) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const rows = items.map(it => ({
      yil: it.yil, ay: it.ay, kullanici_tipi: it.kullanici_tipi, kullanici_adi: it.kullanici_adi,
      odendi: !!it.odendi,
      odeme_tarihi: it.odendi ? (it.odeme_tarihi ?? null) : null,
      updated_by,
      updated_at: now,
    }))

    const { error } = await sb
      .from('nihai_prim_odeme')
      .upsert(rows, { onConflict: 'yil,ay,kullanici_tipi,kullanici_adi' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count: rows.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
